-- Catalog schema for Supabase PostgreSQL 15+; run once as postgres.
-- Metadata only: this creates no connections to the systems being cataloged.
-- Apply to a fresh catalog namespace. A second run fails without replacing data.
-- Browser access and service-role writes remain disabled pending the audited API.
-- See ../README.md for deployment, permissions and validation boundaries.

BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '10s';

CREATE SCHEMA catalog;
CREATE SCHEMA catalog_private;
REVOKE ALL ON SCHEMA catalog, catalog_private FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA catalog
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA catalog_private
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

CREATE DOMAIN catalog_private.nonempty_text AS text
  CHECK (VALUE ~ '[^[:space:]]');
CREATE DOMAIN catalog_private.identifier AS text COLLATE "C"
  CHECK (VALUE ~ '[^[:space:]]' AND VALUE !~ '^[[:space:]]|[[:space:]]$');
CREATE DOMAIN catalog_private.safe_integer AS bigint
  CHECK (VALUE BETWEEN -9007199254740991 AND 9007199254740991);

CREATE FUNCTION catalog_private.is_http_url(value text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
DECLARE authority text; port text;
BEGIN
  IF value !~* '^https?://[^/?#[:space:]]+([/?#][^[:space:]]*)?$'
     OR strpos(value, chr(92)) > 0 THEN RETURN false; END IF;
  authority := substring(value FROM '(?i)^https?://([^/?#]+)');
  IF strpos(authority, '@') > 0 THEN RETURN false; END IF;
  IF left(authority, 1) = '[' THEN
    IF authority !~ '^\[[0-9a-fA-F:.]+\](:[0-9]+)?$' THEN RETURN false; END IF;
    PERFORM substring(authority FROM '^\[([^]]+)\]')::inet;
    port := substring(authority FROM '\]:([0-9]+)$');
  ELSE
    IF authority !~ '^[^:<>"\[\]]+(:[0-9]+)?$' THEN RETURN false; END IF;
    port := substring(authority FROM ':([0-9]+)$');
  END IF;
  RETURN port IS NULL OR port::integer BETWEEN 1 AND 65535;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END;
$$;

CREATE DOMAIN catalog_private.http_url AS text
  CHECK (catalog_private.is_http_url(VALUE));

CREATE FUNCTION catalog_private.valid_text_array(value text[], urls boolean DEFAULT false)
RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
  SELECT (cardinality(value) = 0 OR (array_ndims(value) = 1 AND array_lower(value, 1) = 1))
    AND NOT EXISTS (SELECT FROM unnest(value) item WHERE item IS NULL
      OR item !~ '[^[:space:]]' OR (urls AND NOT catalog_private.is_http_url(item)))
    AND cardinality(value) = (SELECT count(DISTINCT item COLLATE "C") FROM unnest(value) item);
$$;

-- JSONB owned values use conceptual camelCase keys and explicit language suffixes.
CREATE FUNCTION catalog_private.valid_object(value jsonb, specification jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
DECLARE property text; item jsonb; rule jsonb; number numeric;
BEGIN
  IF jsonb_typeof(value) <> 'object' THEN RETURN false; END IF;
  FOR property, rule IN SELECT * FROM jsonb_each(specification) LOOP
    IF rule->>'required' = 'true' AND NOT value ? property THEN RETURN false; END IF;
  END LOOP;
  FOR property, item IN SELECT * FROM jsonb_each(value) LOOP
    rule := specification->property;
    IF rule IS NULL OR item = 'null'::jsonb THEN RETURN false; END IF;
    CASE rule->>'type'
      WHEN 'integer' THEN
        IF jsonb_typeof(item) <> 'number' THEN RETURN false; END IF;
        number := (item #>> '{}')::numeric;
        IF number <> trunc(number) OR abs(number) > 9007199254740991 THEN RETURN false; END IF;
      WHEN 'decimal' THEN
        IF jsonb_typeof(item) <> 'string' OR (item #>> '{}') !~ '^-?(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$'
          OR item #>> '{}' = '-0' THEN RETURN false; END IF;
        number := (item #>> '{}')::numeric;
      ELSE
        IF jsonb_typeof(item) <> 'string' OR (item #>> '{}') !~ '[^[:space:]]' THEN RETURN false; END IF;
        IF rule->>'type' = 'url' AND NOT catalog_private.is_http_url(item #>> '{}') THEN RETURN false; END IF;
        IF rule->>'type' = 'language' AND (item #>> '{}') !~ '^[a-zA-Z]{1,8}(-[a-zA-Z0-9]{1,8})*$' THEN RETURN false; END IF;
    END CASE;
    IF rule ? 'enum' AND NOT (rule->'enum') @> jsonb_build_array(item) THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END;
$$;

CREATE FUNCTION catalog_private.valid_organisation(value jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
  SELECT catalog_private.valid_object(value, '{
  "name_de": {
    "type": "text"
  },
  "name_it": {
    "type": "text"
  },
  "name_fr": {
    "type": "text"
  },
  "name_en": {
    "type": "text"
  },
  "websiteUrl": {
    "type": "url"
  }
}'::jsonb)
    AND value ?| ARRAY['name_de', 'name_it', 'name_fr', 'name_en'];
$$;

CREATE FUNCTION catalog_private.valid_documentation_links(value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
DECLARE item jsonb; pairs jsonb := '[]'::jsonb; pair jsonb;
BEGIN
  IF jsonb_typeof(value) <> 'array' THEN RETURN false; END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(value) LOOP
    IF NOT catalog_private.valid_object(item, '{
  "url": {
    "type": "url",
    "required": true
  },
  "title_de": {
    "type": "text"
  },
  "title_it": {
    "type": "text"
  },
  "title_fr": {
    "type": "text"
  },
  "title_en": {
    "type": "text"
  },
  "purpose": {
    "type": "text",
    "required": true,
    "enum": [
      "documentation",
      "definition",
      "standard",
      "terminology",
      "license",
      "access"
    ]
  },
  "language": {
    "type": "language"
  },
  "externalIdentifier": {
    "type": "text"
  }
}'::jsonb) THEN RETURN false; END IF;
    pair := jsonb_build_array(item->>'url', item->>'purpose');
    IF pairs @> jsonb_build_array(pair) THEN RETURN false; END IF;
    pairs := pairs || jsonb_build_array(pair);
  END LOOP;
  RETURN true;
END;
$$;

CREATE FUNCTION catalog_private.valid_value_specification(value jsonb, business boolean)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
DECLARE kind text := value->>'valueType';
BEGIN
  IF NOT catalog_private.valid_object(value, '{
  "valueType": {
    "type": "text",
    "required": true,
    "enum": [
      "text",
      "identifier",
      "integer",
      "decimal",
      "boolean",
      "date",
      "dateTime",
      "year",
      "code",
      "geometry",
      "structured"
    ]
  },
  "format": {
    "type": "text"
  },
  "minimumLength": {
    "type": "integer"
  },
  "maximumLength": {
    "type": "integer"
  },
  "minimumValue": {
    "type": "decimal"
  },
  "maximumValue": {
    "type": "decimal"
  },
  "precision": {
    "type": "integer"
  },
  "scale": {
    "type": "integer"
  },
  "unit": {
    "type": "text"
  },
  "geometryType": {
    "type": "text"
  },
  "coordinateReferenceSystem": {
    "type": "text"
  },
  "ruleNotes_de": {
    "type": "text"
  },
  "ruleNotes_it": {
    "type": "text"
  },
  "ruleNotes_fr": {
    "type": "text"
  },
  "ruleNotes_en": {
    "type": "text"
  }
}'::jsonb) THEN RETURN false; END IF;
  IF business AND value - ARRAY['valueType','format','unit','geometryType','coordinateReferenceSystem'] <> '{}'::jsonb THEN RETURN false; END IF;
  IF value ?| ARRAY['minimumLength','maximumLength'] AND kind NOT IN ('text','code','identifier') THEN RETURN false; END IF;
  IF value ?| ARRAY['minimumValue','maximumValue','precision','scale'] AND kind NOT IN ('integer','decimal','year') THEN RETURN false; END IF;
  IF value ?| ARRAY['geometryType','coordinateReferenceSystem'] AND kind <> 'geometry' THEN RETURN false; END IF;
  IF (value->>'minimumLength')::bigint < 0 OR (value->>'maximumLength')::bigint < 0
    OR (value->>'minimumLength')::bigint > (value->>'maximumLength')::bigint
    OR (value->>'minimumValue')::numeric > (value->>'maximumValue')::numeric
    OR (value->>'precision')::bigint <= 0 THEN RETURN false; END IF;
  RETURN true;
END;
$$;

-- Actor
CREATE TABLE catalog.actor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier catalog_private.identifier NOT NULL UNIQUE,
  row_version catalog_private.safe_integer NOT NULL DEFAULT 1,
  created_on date,
  modified_on date,
  name_de catalog_private.nonempty_text,
  name_it catalog_private.nonempty_text,
  name_fr catalog_private.nonempty_text,
  name_en catalog_private.nonempty_text,
  description_de catalog_private.nonempty_text,
  description_it catalog_private.nonempty_text,
  description_fr catalog_private.nonempty_text,
  description_en catalog_private.nonempty_text,
  comment catalog_private.nonempty_text,
  actor_type text COLLATE "C" NOT NULL,
  website_url catalog_private.http_url,
  CONSTRAINT actor_check_1 CHECK (row_version > 0),
  CONSTRAINT actor_check_2 CHECK (isfinite(created_on)),
  CONSTRAINT actor_check_3 CHECK (isfinite(modified_on)),
  CONSTRAINT actor_check_4 CHECK (actor_type IN ('person', 'organisation')),
  CONSTRAINT actor_check_5 CHECK (num_nonnulls(name_de, name_it, name_fr, name_en) > 0),
  CONSTRAINT actor_check_6 CHECK (modified_on >= created_on)
);
COMMENT ON COLUMN catalog.actor.id IS 'Internal ID. Immutable internal identity, separate from the public catalog identifier and source identifiers.';
COMMENT ON COLUMN catalog.actor.identifier IS 'ID. Stable and unique within its kind. Child identifiers distinguish records across owners.';
COMMENT ON COLUMN catalog.actor.row_version IS 'Edit revision. Automatically maintained edit revision; initially 1 and incremented once per committed change. Separate from catalog definition version.';
COMMENT ON COLUMN catalog.actor.created_on IS 'Created. Date the catalog record was created; unknown historical dates remain unknown.';
COMMENT ON COLUMN catalog.actor.modified_on IS 'Last modified. Date the catalog record last changed; not before createdOn. History and edit revision establish order.';
COMMENT ON COLUMN catalog.actor.name_de IS 'Name (DE). German name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.actor.name_it IS 'Name (IT). Italian name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.actor.name_fr IS 'Name (FR). French name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.actor.name_en IS 'Name (EN). English name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.actor.description_de IS 'Description (DE). German. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.actor.description_it IS 'Description (IT). Italian. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.actor.description_fr IS 'Description (FR). French. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.actor.description_en IS 'Description (EN). English. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.actor.comment IS 'Comment. Internal note in its authored language; no translation variants, fallback or parent inheritance.';
COMMENT ON COLUMN catalog.actor.actor_type IS 'Actor type. person, organisation.';
COMMENT ON COLUMN catalog.actor.website_url IS 'Website. Official website or directory entry. Do not fabricate URLs from names.';

-- Domain
CREATE TABLE catalog.domain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier catalog_private.identifier NOT NULL UNIQUE,
  row_version catalog_private.safe_integer NOT NULL DEFAULT 1,
  created_on date,
  modified_on date,
  name_de catalog_private.nonempty_text,
  name_it catalog_private.nonempty_text,
  name_fr catalog_private.nonempty_text,
  name_en catalog_private.nonempty_text,
  description_de catalog_private.nonempty_text,
  description_it catalog_private.nonempty_text,
  description_fr catalog_private.nonempty_text,
  description_en catalog_private.nonempty_text,
  comment catalog_private.nonempty_text,
  documentation_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text COLLATE "C" NOT NULL DEFAULT 'draft',
  version catalog_private.nonempty_text,
  version_date date,
  responsible_organisation jsonb,
  data_owner_id uuid,
  data_steward_id uuid,
  contact_actor_id uuid,
  parent_domain_id uuid,
  CONSTRAINT domain_check_1 CHECK (row_version > 0),
  CONSTRAINT domain_check_2 CHECK (isfinite(created_on)),
  CONSTRAINT domain_check_3 CHECK (isfinite(modified_on)),
  CONSTRAINT domain_check_4 CHECK (catalog_private.valid_documentation_links(documentation_links)),
  CONSTRAINT domain_check_5 CHECK (status IN ('draft', 'valid', 'retired')),
  CONSTRAINT domain_check_6 CHECK (isfinite(version_date)),
  CONSTRAINT domain_check_7 CHECK (catalog_private.valid_organisation(responsible_organisation)),
  CONSTRAINT domain_check_8 CHECK (num_nonnulls(name_de, name_it, name_fr, name_en) > 0),
  CONSTRAINT domain_check_9 CHECK (modified_on >= created_on),
  CONSTRAINT domain_check_10 CHECK (version_date IS NULL OR version IS NOT NULL),
  CONSTRAINT domain_check_11 CHECK (status <> 'valid' OR num_nonnulls(description_de, description_it, description_fr, description_en) > 0),
  CONSTRAINT domain_check_12 CHECK (parent_domain_id <> id)
);
COMMENT ON COLUMN catalog.domain.id IS 'Internal ID. Immutable internal identity, separate from the public catalog identifier and source identifiers.';
COMMENT ON COLUMN catalog.domain.identifier IS 'ID. Stable and unique within its kind. Child identifiers distinguish records across owners.';
COMMENT ON COLUMN catalog.domain.row_version IS 'Edit revision. Automatically maintained edit revision; initially 1 and incremented once per committed change. Separate from catalog definition version.';
COMMENT ON COLUMN catalog.domain.created_on IS 'Created. Date the catalog record was created; unknown historical dates remain unknown.';
COMMENT ON COLUMN catalog.domain.modified_on IS 'Last modified. Date the catalog record last changed; not before createdOn. History and edit revision establish order.';
COMMENT ON COLUMN catalog.domain.name_de IS 'Name (DE). German name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.domain.name_it IS 'Name (IT). Italian name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.domain.name_fr IS 'Name (FR). French name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.domain.name_en IS 'Name (EN). English name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.domain.description_de IS 'Description (DE). German. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid.';
COMMENT ON COLUMN catalog.domain.description_it IS 'Description (IT). Italian. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid.';
COMMENT ON COLUMN catalog.domain.description_fr IS 'Description (FR). French. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid.';
COMMENT ON COLUMN catalog.domain.description_en IS 'Description (EN). English. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid.';
COMMENT ON COLUMN catalog.domain.comment IS 'Comment. Internal note in its authored language; no translation variants, fallback or parent inheritance.';
COMMENT ON COLUMN catalog.domain.documentation_links IS 'More information. Curated supporting links; deduplicate identical URL/purpose pairs.';
COMMENT ON COLUMN catalog.domain.status IS 'Status. draft, valid, retired; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations.';
COMMENT ON COLUMN catalog.domain.version IS 'Version. Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion.';
COMMENT ON COLUMN catalog.domain.version_date IS 'Version date. Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date.';
COMMENT ON COLUMN catalog.domain.responsible_organisation IS 'Responsible organisation. Inline organisation; no Actor required. Apply the documented parent fallback only when this whole value is absent.';
COMMENT ON COLUMN catalog.domain.data_owner_id IS 'Data owner. Accountable person/organisation. One optional Actor; apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.domain.data_steward_id IS 'Data steward. Person/organisation maintaining meaning and metadata. One optional Actor; apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.domain.contact_actor_id IS 'Contact. Optional managed contact with name and website/contact page. External links may stay in responsibleOrganisation. Apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.domain.parent_domain_id IS 'Parent domain. Broader domain; no self-reference or cycles.';

-- System
CREATE TABLE catalog.system (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier catalog_private.identifier NOT NULL UNIQUE,
  row_version catalog_private.safe_integer NOT NULL DEFAULT 1,
  created_on date,
  modified_on date,
  name_de catalog_private.nonempty_text,
  name_it catalog_private.nonempty_text,
  name_fr catalog_private.nonempty_text,
  name_en catalog_private.nonempty_text,
  description_de catalog_private.nonempty_text,
  description_it catalog_private.nonempty_text,
  description_fr catalog_private.nonempty_text,
  description_en catalog_private.nonempty_text,
  comment catalog_private.nonempty_text,
  documentation_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text COLLATE "C" NOT NULL DEFAULT 'draft',
  version catalog_private.nonempty_text,
  version_date date,
  responsible_organisation jsonb,
  data_owner_id uuid,
  data_steward_id uuid,
  data_custodian_id uuid,
  contact_actor_id uuid,
  classification text COLLATE "C",
  contains_personal_data boolean,
  system_type text COLLATE "C",
  technology catalog_private.nonempty_text,
  CONSTRAINT system_check_1 CHECK (row_version > 0),
  CONSTRAINT system_check_2 CHECK (isfinite(created_on)),
  CONSTRAINT system_check_3 CHECK (isfinite(modified_on)),
  CONSTRAINT system_check_4 CHECK (catalog_private.valid_documentation_links(documentation_links)),
  CONSTRAINT system_check_5 CHECK (status IN ('draft', 'valid', 'retired')),
  CONSTRAINT system_check_6 CHECK (isfinite(version_date)),
  CONSTRAINT system_check_7 CHECK (catalog_private.valid_organisation(responsible_organisation)),
  CONSTRAINT system_check_8 CHECK (classification IN ('public', 'internal', 'confidential', 'secret')),
  CONSTRAINT system_check_9 CHECK (system_type IN ('application', 'register', 'modelRepository', 'distributedSource')),
  CONSTRAINT system_check_10 CHECK (num_nonnulls(name_de, name_it, name_fr, name_en) > 0),
  CONSTRAINT system_check_11 CHECK (modified_on >= created_on),
  CONSTRAINT system_check_12 CHECK (version_date IS NULL OR version IS NOT NULL)
);
COMMENT ON COLUMN catalog.system.id IS 'Internal ID. Immutable internal identity, separate from the public catalog identifier and source identifiers.';
COMMENT ON COLUMN catalog.system.identifier IS 'ID. Stable and unique within its kind. Child identifiers distinguish records across owners.';
COMMENT ON COLUMN catalog.system.row_version IS 'Edit revision. Automatically maintained edit revision; initially 1 and incremented once per committed change. Separate from catalog definition version.';
COMMENT ON COLUMN catalog.system.created_on IS 'Created. Date the catalog record was created; unknown historical dates remain unknown.';
COMMENT ON COLUMN catalog.system.modified_on IS 'Last modified. Date the catalog record last changed; not before createdOn. History and edit revision establish order.';
COMMENT ON COLUMN catalog.system.name_de IS 'Name (DE). German name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.system.name_it IS 'Name (IT). Italian name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.system.name_fr IS 'Name (FR). French name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.system.name_en IS 'Name (EN). English name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.system.description_de IS 'Description (DE). German. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.system.description_it IS 'Description (IT). Italian. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.system.description_fr IS 'Description (FR). French. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.system.description_en IS 'Description (EN). English. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.system.comment IS 'Comment. Internal note in its authored language; no translation variants, fallback or parent inheritance.';
COMMENT ON COLUMN catalog.system.documentation_links IS 'More information. Curated supporting links; deduplicate identical URL/purpose pairs.';
COMMENT ON COLUMN catalog.system.status IS 'Status. draft, valid, retired; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations.';
COMMENT ON COLUMN catalog.system.version IS 'Version. Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion.';
COMMENT ON COLUMN catalog.system.version_date IS 'Version date. Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date.';
COMMENT ON COLUMN catalog.system.responsible_organisation IS 'Responsible organisation. Inline organisation; no Actor required. Apply the documented parent fallback only when this whole value is absent.';
COMMENT ON COLUMN catalog.system.data_owner_id IS 'Data owner. Accountable person/organisation. One optional Actor; apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.system.data_steward_id IS 'Data steward. Person/organisation maintaining meaning and metadata. One optional Actor; apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.system.data_custodian_id IS 'Data custodian. Maintains the technical source; may be a person or organisation. One explicit actor per role; missing means undocumented or inherited as specified below.';
COMMENT ON COLUMN catalog.system.contact_actor_id IS 'Contact. Optional managed contact with name and website/contact page. External links may stay in responsibleOrganisation. Apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.system.classification IS 'Classification. public, internal, confidential, secret. Classification of the described information, separate from technical access.';
COMMENT ON COLUMN catalog.system.contains_personal_data IS 'Personal data. Whether the described data contains personal data. Listing a catalog contact does not establish this for the underlying dataset.';
COMMENT ON COLUMN catalog.system.system_type IS 'System type. application, register, modelRepository, distributedSource; omit if unreviewed.';
COMMENT ON COLUMN catalog.system.technology IS 'Technology. Documented platform or technology name.';

-- BusinessObject
CREATE TABLE catalog.business_object (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier catalog_private.identifier NOT NULL UNIQUE,
  row_version catalog_private.safe_integer NOT NULL DEFAULT 1,
  created_on date,
  modified_on date,
  name_de catalog_private.nonempty_text,
  name_it catalog_private.nonempty_text,
  name_fr catalog_private.nonempty_text,
  name_en catalog_private.nonempty_text,
  description_de catalog_private.nonempty_text,
  description_it catalog_private.nonempty_text,
  description_fr catalog_private.nonempty_text,
  description_en catalog_private.nonempty_text,
  comment catalog_private.nonempty_text,
  documentation_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text COLLATE "C" NOT NULL DEFAULT 'draft',
  version catalog_private.nonempty_text,
  version_date date,
  responsible_organisation jsonb,
  data_owner_id uuid,
  data_steward_id uuid,
  contact_actor_id uuid,
  classification text COLLATE "C",
  contains_personal_data boolean,
  domain_id uuid NOT NULL,
  normative_references text[] COLLATE "C" NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT business_object_check_1 CHECK (row_version > 0),
  CONSTRAINT business_object_check_2 CHECK (isfinite(created_on)),
  CONSTRAINT business_object_check_3 CHECK (isfinite(modified_on)),
  CONSTRAINT business_object_check_4 CHECK (catalog_private.valid_documentation_links(documentation_links)),
  CONSTRAINT business_object_check_5 CHECK (status IN ('draft', 'valid', 'retired')),
  CONSTRAINT business_object_check_6 CHECK (isfinite(version_date)),
  CONSTRAINT business_object_check_7 CHECK (catalog_private.valid_organisation(responsible_organisation)),
  CONSTRAINT business_object_check_8 CHECK (classification IN ('public', 'internal', 'confidential', 'secret')),
  CONSTRAINT business_object_check_9 CHECK (catalog_private.valid_text_array(normative_references, false)),
  CONSTRAINT business_object_check_10 CHECK (num_nonnulls(name_de, name_it, name_fr, name_en) > 0),
  CONSTRAINT business_object_check_11 CHECK (modified_on >= created_on),
  CONSTRAINT business_object_check_12 CHECK (version_date IS NULL OR version IS NOT NULL),
  CONSTRAINT business_object_check_13 CHECK (status <> 'valid' OR num_nonnulls(description_de, description_it, description_fr, description_en) > 0)
);
COMMENT ON COLUMN catalog.business_object.id IS 'Internal ID. Immutable internal identity, separate from the public catalog identifier and source identifiers.';
COMMENT ON COLUMN catalog.business_object.identifier IS 'ID. Stable and unique within its kind. Child identifiers distinguish records across owners.';
COMMENT ON COLUMN catalog.business_object.row_version IS 'Edit revision. Automatically maintained edit revision; initially 1 and incremented once per committed change. Separate from catalog definition version.';
COMMENT ON COLUMN catalog.business_object.created_on IS 'Created. Date the catalog record was created; unknown historical dates remain unknown.';
COMMENT ON COLUMN catalog.business_object.modified_on IS 'Last modified. Date the catalog record last changed; not before createdOn. History and edit revision establish order.';
COMMENT ON COLUMN catalog.business_object.name_de IS 'Name (DE). German name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.business_object.name_it IS 'Name (IT). Italian name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.business_object.name_fr IS 'Name (FR). French name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.business_object.name_en IS 'Name (EN). English name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.business_object.description_de IS 'Description (DE). German. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid.';
COMMENT ON COLUMN catalog.business_object.description_it IS 'Description (IT). Italian. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid.';
COMMENT ON COLUMN catalog.business_object.description_fr IS 'Description (FR). French. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid.';
COMMENT ON COLUMN catalog.business_object.description_en IS 'Description (EN). English. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid.';
COMMENT ON COLUMN catalog.business_object.comment IS 'Comment. Internal note in its authored language; no translation variants, fallback or parent inheritance.';
COMMENT ON COLUMN catalog.business_object.documentation_links IS 'More information. Curated supporting links; deduplicate identical URL/purpose pairs.';
COMMENT ON COLUMN catalog.business_object.status IS 'Status. draft, valid, retired; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations.';
COMMENT ON COLUMN catalog.business_object.version IS 'Version. Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion.';
COMMENT ON COLUMN catalog.business_object.version_date IS 'Version date. Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date.';
COMMENT ON COLUMN catalog.business_object.responsible_organisation IS 'Responsible organisation. Inline organisation; no Actor required. Apply the documented parent fallback only when this whole value is absent.';
COMMENT ON COLUMN catalog.business_object.data_owner_id IS 'Data owner. Accountable person/organisation. One optional Actor; apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.business_object.data_steward_id IS 'Data steward. Person/organisation maintaining meaning and metadata. One optional Actor; apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.business_object.contact_actor_id IS 'Contact. Optional managed contact with name and website/contact page. External links may stay in responsibleOrganisation. Apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.business_object.classification IS 'Classification. public, internal, confidential, secret. Classification of the described information, separate from technical access.';
COMMENT ON COLUMN catalog.business_object.contains_personal_data IS 'Personal data. Whether the described data contains personal data. Listing a catalog contact does not establish this for the underlying dataset.';
COMMENT ON COLUMN catalog.business_object.domain_id IS 'Domain. Primary business domain. A copied domain label is not the relationship.';
COMMENT ON COLUMN catalog.business_object.normative_references IS 'Standard reference. Documented standards/rules, including edition when known. URLs belong in DocumentationLink.';

-- CodeList
CREATE TABLE catalog.code_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier catalog_private.identifier NOT NULL UNIQUE,
  row_version catalog_private.safe_integer NOT NULL DEFAULT 1,
  created_on date,
  modified_on date,
  name_de catalog_private.nonempty_text,
  name_it catalog_private.nonempty_text,
  name_fr catalog_private.nonempty_text,
  name_en catalog_private.nonempty_text,
  description_de catalog_private.nonempty_text,
  description_it catalog_private.nonempty_text,
  description_fr catalog_private.nonempty_text,
  description_en catalog_private.nonempty_text,
  comment catalog_private.nonempty_text,
  documentation_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text COLLATE "C" NOT NULL DEFAULT 'draft',
  version catalog_private.nonempty_text,
  version_date date,
  domain_id uuid,
  business_object_id uuid,
  authority_organisation jsonb,
  normative_references text[] COLLATE "C" NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT code_list_check_1 CHECK (row_version > 0),
  CONSTRAINT code_list_check_2 CHECK (isfinite(created_on)),
  CONSTRAINT code_list_check_3 CHECK (isfinite(modified_on)),
  CONSTRAINT code_list_check_4 CHECK (catalog_private.valid_documentation_links(documentation_links)),
  CONSTRAINT code_list_check_5 CHECK (status IN ('draft', 'valid', 'retired')),
  CONSTRAINT code_list_check_6 CHECK (isfinite(version_date)),
  CONSTRAINT code_list_check_7 CHECK (catalog_private.valid_organisation(authority_organisation)),
  CONSTRAINT code_list_check_8 CHECK (catalog_private.valid_text_array(normative_references, false)),
  CONSTRAINT code_list_check_9 CHECK (num_nonnulls(name_de, name_it, name_fr, name_en) > 0),
  CONSTRAINT code_list_check_10 CHECK (modified_on >= created_on),
  CONSTRAINT code_list_check_11 CHECK (version_date IS NULL OR version IS NOT NULL)
);
COMMENT ON COLUMN catalog.code_list.id IS 'Internal ID. Immutable internal identity, separate from the public catalog identifier and source identifiers.';
COMMENT ON COLUMN catalog.code_list.identifier IS 'ID. Stable and unique within its kind. Child identifiers distinguish records across owners.';
COMMENT ON COLUMN catalog.code_list.row_version IS 'Edit revision. Automatically maintained edit revision; initially 1 and incremented once per committed change. Separate from catalog definition version.';
COMMENT ON COLUMN catalog.code_list.created_on IS 'Created. Date the catalog record was created; unknown historical dates remain unknown.';
COMMENT ON COLUMN catalog.code_list.modified_on IS 'Last modified. Date the catalog record last changed; not before createdOn. History and edit revision establish order.';
COMMENT ON COLUMN catalog.code_list.name_de IS 'Name (DE). German name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.code_list.name_it IS 'Name (IT). Italian name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.code_list.name_fr IS 'Name (FR). French name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.code_list.name_en IS 'Name (EN). English name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.code_list.description_de IS 'Description (DE). German. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.code_list.description_it IS 'Description (IT). Italian. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.code_list.description_fr IS 'Description (FR). French. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.code_list.description_en IS 'Description (EN). English. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.code_list.comment IS 'Comment. Internal note in its authored language; no translation variants, fallback or parent inheritance.';
COMMENT ON COLUMN catalog.code_list.documentation_links IS 'More information. Curated supporting links; deduplicate identical URL/purpose pairs.';
COMMENT ON COLUMN catalog.code_list.status IS 'Status. draft, valid, retired; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations.';
COMMENT ON COLUMN catalog.code_list.version IS 'Version. Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion.';
COMMENT ON COLUMN catalog.code_list.version_date IS 'Version date. Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date.';
COMMENT ON COLUMN catalog.code_list.domain_id IS 'Domain. Explicit primary domain; if absent, derive it from businessObjectId when that object is active. Explicit domain takes precedence.';
COMMENT ON COLUMN catalog.code_list.business_object_id IS 'Business object. Primary classified concept. Actual attribute/field usage comes from their direct references.';
COMMENT ON COLUMN catalog.code_list.authority_organisation IS 'Source authority. Organisation defining the vocabulary, recorded directly. The sole organisation value on a CodeList. Keep unresolved authority wording in comment/import notes; do not infer an organisation from a standard citation.';
COMMENT ON COLUMN catalog.code_list.normative_references IS 'Standard reference. Documented standards/rules, including edition when known. Preserve partial or composite citations intact; do not invent a standard identifier. URLs belong in DocumentationLink.';

-- CodeValue
CREATE TABLE catalog.code_value (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier catalog_private.identifier NOT NULL UNIQUE,
  row_version catalog_private.safe_integer NOT NULL DEFAULT 1,
  created_on date,
  modified_on date,
  name_de catalog_private.nonempty_text,
  name_it catalog_private.nonempty_text,
  name_fr catalog_private.nonempty_text,
  name_en catalog_private.nonempty_text,
  description_de catalog_private.nonempty_text,
  description_it catalog_private.nonempty_text,
  description_fr catalog_private.nonempty_text,
  description_en catalog_private.nonempty_text,
  comment catalog_private.nonempty_text,
  documentation_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  code_list_id uuid NOT NULL,
  code catalog_private.nonempty_text COLLATE "C" NOT NULL,
  short_name_de catalog_private.nonempty_text,
  short_name_it catalog_private.nonempty_text,
  short_name_fr catalog_private.nonempty_text,
  short_name_en catalog_private.nonempty_text,
  parent_code_value_id uuid,
  UNIQUE (code_list_id, code),
  UNIQUE (code_list_id, id),
  CONSTRAINT code_value_check_1 CHECK (row_version > 0),
  CONSTRAINT code_value_check_2 CHECK (isfinite(created_on)),
  CONSTRAINT code_value_check_3 CHECK (isfinite(modified_on)),
  CONSTRAINT code_value_check_4 CHECK (catalog_private.valid_documentation_links(documentation_links)),
  CONSTRAINT code_value_check_5 CHECK (num_nonnulls(name_de, name_it, name_fr, name_en) > 0),
  CONSTRAINT code_value_check_6 CHECK (modified_on >= created_on),
  CONSTRAINT code_value_check_7 CHECK (parent_code_value_id <> id)
);
COMMENT ON COLUMN catalog.code_value.id IS 'Internal ID. Immutable internal identity, separate from the public catalog identifier and source identifiers.';
COMMENT ON COLUMN catalog.code_value.identifier IS 'ID. Stable and unique within its kind. Child identifiers distinguish records across owners.';
COMMENT ON COLUMN catalog.code_value.row_version IS 'Edit revision. Automatically maintained edit revision; initially 1 and incremented once per committed change. Separate from catalog definition version.';
COMMENT ON COLUMN catalog.code_value.created_on IS 'Created. Date the catalog record was created; unknown historical dates remain unknown.';
COMMENT ON COLUMN catalog.code_value.modified_on IS 'Last modified. Date the catalog record last changed; not before createdOn. History and edit revision establish order.';
COMMENT ON COLUMN catalog.code_value.name_de IS 'Name (DE). German name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.code_value.name_it IS 'Name (IT). Italian name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.code_value.name_fr IS 'Name (FR). French name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.code_value.name_en IS 'Name (EN). English name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.code_value.description_de IS 'Description (DE). German. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.code_value.description_it IS 'Description (IT). Italian. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.code_value.description_fr IS 'Description (FR). French. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.code_value.description_en IS 'Description (EN). English. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.code_value.comment IS 'Comment. Internal note in its authored language; no translation variants, fallback or parent inheritance.';
COMMENT ON COLUMN catalog.code_value.documentation_links IS 'More information. Curated supporting links; deduplicate identical URL/purpose pairs.';
COMMENT ON COLUMN catalog.code_value.code_list_id IS 'Code list. Owning vocabulary.';
COMMENT ON COLUMN catalog.code_value.code IS 'Code. Unique within the list. Preserve leading zeros, punctuation, case and symbolic paths. Source order is not a wire code.';
COMMENT ON COLUMN catalog.code_value.short_name_de IS 'Short name (DE). German. Official abbreviations where available.';
COMMENT ON COLUMN catalog.code_value.short_name_it IS 'Short name (IT). Italian. Official abbreviations where available.';
COMMENT ON COLUMN catalog.code_value.short_name_fr IS 'Short name (FR). French. Official abbreviations where available.';
COMMENT ON COLUMN catalog.code_value.short_name_en IS 'Short name (EN). English. Official abbreviations where available.';
COMMENT ON COLUMN catalog.code_value.parent_code_value_id IS 'Parent code value. Broader member in the same vocabulary; enforce the composite FK with codeListId. No self-reference or cycles. Do not invent selectable parent codes from source headings.';

-- QualityRequirement
CREATE TABLE catalog.quality_requirement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier catalog_private.identifier NOT NULL UNIQUE,
  row_version catalog_private.safe_integer NOT NULL DEFAULT 1,
  created_on date,
  modified_on date,
  name_de catalog_private.nonempty_text,
  name_it catalog_private.nonempty_text,
  name_fr catalog_private.nonempty_text,
  name_en catalog_private.nonempty_text,
  description_de catalog_private.nonempty_text,
  description_it catalog_private.nonempty_text,
  description_fr catalog_private.nonempty_text,
  description_en catalog_private.nonempty_text,
  comment catalog_private.nonempty_text,
  documentation_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text COLLATE "C" NOT NULL DEFAULT 'draft',
  version catalog_private.nonempty_text,
  version_date date,
  responsible_organisation jsonb,
  contact_actor_id uuid,
  rule_type text COLLATE "C" NOT NULL,
  comparison_value numeric,
  dimension text COLLATE "C" NOT NULL,
  CONSTRAINT quality_requirement_check_1 CHECK (row_version > 0),
  CONSTRAINT quality_requirement_check_2 CHECK (isfinite(created_on)),
  CONSTRAINT quality_requirement_check_3 CHECK (isfinite(modified_on)),
  CONSTRAINT quality_requirement_check_4 CHECK (catalog_private.valid_documentation_links(documentation_links)),
  CONSTRAINT quality_requirement_check_5 CHECK (status IN ('draft', 'valid', 'retired')),
  CONSTRAINT quality_requirement_check_6 CHECK (isfinite(version_date)),
  CONSTRAINT quality_requirement_check_7 CHECK (catalog_private.valid_organisation(responsible_organisation)),
  CONSTRAINT quality_requirement_check_8 CHECK (rule_type IN ('required', 'notNull', 'unique', 'greaterThan', 'custom')),
  CONSTRAINT quality_requirement_check_9 CHECK (comparison_value NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
  CONSTRAINT quality_requirement_check_10 CHECK (dimension IN ('completeness', 'validity', 'consistency', 'uniqueness', 'timeliness', 'accuracy')),
  CONSTRAINT quality_requirement_check_11 CHECK (num_nonnulls(name_de, name_it, name_fr, name_en) > 0),
  CONSTRAINT quality_requirement_check_12 CHECK (modified_on >= created_on),
  CONSTRAINT quality_requirement_check_13 CHECK (version_date IS NULL OR version IS NOT NULL),
  CONSTRAINT quality_requirement_check_14 CHECK (status <> 'valid' OR num_nonnulls(description_de, description_it, description_fr, description_en) > 0),
  CONSTRAINT quality_requirement_check_15 CHECK ((rule_type = 'greaterThan') = (comparison_value IS NOT NULL))
);
COMMENT ON COLUMN catalog.quality_requirement.id IS 'Internal ID. Immutable internal identity, separate from the public catalog identifier and source identifiers.';
COMMENT ON COLUMN catalog.quality_requirement.identifier IS 'ID. Stable rule identifier, unique in the rule library and independent of translated labels or assignments.';
COMMENT ON COLUMN catalog.quality_requirement.row_version IS 'Edit revision. Automatically maintained edit revision; initially 1 and incremented once per committed change. Separate from catalog definition version.';
COMMENT ON COLUMN catalog.quality_requirement.created_on IS 'Created. Date the catalog record was created; unknown historical dates remain unknown.';
COMMENT ON COLUMN catalog.quality_requirement.modified_on IS 'Last modified. Date the catalog record last changed; not before createdOn. History and edit revision establish order.';
COMMENT ON COLUMN catalog.quality_requirement.name_de IS 'Name (DE). German name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.quality_requirement.name_it IS 'Name (IT). Italian name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.quality_requirement.name_fr IS 'Name (FR). French name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.quality_requirement.name_en IS 'Name (EN). English name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.quality_requirement.description_de IS 'Description (DE). German. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid.';
COMMENT ON COLUMN catalog.quality_requirement.description_it IS 'Description (IT). Italian. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid.';
COMMENT ON COLUMN catalog.quality_requirement.description_fr IS 'Description (FR). French. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid.';
COMMENT ON COLUMN catalog.quality_requirement.description_en IS 'Description (EN). English. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid.';
COMMENT ON COLUMN catalog.quality_requirement.comment IS 'Comment. Internal note in its authored language; no translation variants, fallback or parent inheritance.';
COMMENT ON COLUMN catalog.quality_requirement.documentation_links IS 'More information. Curated supporting links; deduplicate identical URL/purpose pairs.';
COMMENT ON COLUMN catalog.quality_requirement.status IS 'Status. draft, valid, retired; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations.';
COMMENT ON COLUMN catalog.quality_requirement.version IS 'Version. Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion.';
COMMENT ON COLUMN catalog.quality_requirement.version_date IS 'Version date. Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date.';
COMMENT ON COLUMN catalog.quality_requirement.responsible_organisation IS 'Responsible organisation. Organisation responsible for maintaining this rule; stored inline. No parent responsibility inheritance.';
COMMENT ON COLUMN catalog.quality_requirement.contact_actor_id IS 'Contact. Optional managed contact for this rule. Organisation details may be supplied independently in responsibleOrganisation. No parent responsibility inheritance.';
COMMENT ON COLUMN catalog.quality_requirement.rule_type IS 'Rule type. required, notNull, unique, greaterThan, custom. Describes the rule semantics below; no executable rule body is stored.';
COMMENT ON COLUMN catalog.quality_requirement.comparison_value IS 'Comparison value. Required only for greaterThan; forbidden for the other rule types. Zero is a valid value. Stored once on the reusable rule, with no per-assignment override.';
COMMENT ON COLUMN catalog.quality_requirement.dimension IS 'Quality dimension. completeness, validity, consistency, uniqueness, timeliness, accuracy. Local classification tokens, not a standards-conformance claim.';

-- BusinessAttribute
CREATE TABLE catalog.business_attribute (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier catalog_private.identifier NOT NULL UNIQUE,
  row_version catalog_private.safe_integer NOT NULL DEFAULT 1,
  created_on date,
  modified_on date,
  name_de catalog_private.nonempty_text,
  name_it catalog_private.nonempty_text,
  name_fr catalog_private.nonempty_text,
  name_en catalog_private.nonempty_text,
  description_de catalog_private.nonempty_text,
  description_it catalog_private.nonempty_text,
  description_fr catalog_private.nonempty_text,
  description_en catalog_private.nonempty_text,
  comment catalog_private.nonempty_text,
  documentation_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text COLLATE "C" NOT NULL DEFAULT 'draft',
  version catalog_private.nonempty_text,
  version_date date,
  responsible_organisation jsonb,
  data_owner_id uuid,
  data_steward_id uuid,
  contact_actor_id uuid,
  classification text COLLATE "C",
  contains_personal_data boolean,
  business_object_id uuid NOT NULL,
  semantic_name catalog_private.identifier NOT NULL,
  value_specification jsonb,
  is_identifier boolean,
  code_list_id uuid,
  UNIQUE (business_object_id, semantic_name),
  CONSTRAINT business_attribute_check_1 CHECK (row_version > 0),
  CONSTRAINT business_attribute_check_2 CHECK (isfinite(created_on)),
  CONSTRAINT business_attribute_check_3 CHECK (isfinite(modified_on)),
  CONSTRAINT business_attribute_check_4 CHECK (catalog_private.valid_documentation_links(documentation_links)),
  CONSTRAINT business_attribute_check_5 CHECK (status IN ('draft', 'valid', 'retired')),
  CONSTRAINT business_attribute_check_6 CHECK (isfinite(version_date)),
  CONSTRAINT business_attribute_check_7 CHECK (catalog_private.valid_organisation(responsible_organisation)),
  CONSTRAINT business_attribute_check_8 CHECK (classification IN ('public', 'internal', 'confidential', 'secret')),
  CONSTRAINT business_attribute_check_9 CHECK (catalog_private.valid_value_specification(value_specification, true)),
  CONSTRAINT business_attribute_check_10 CHECK (num_nonnulls(name_de, name_it, name_fr, name_en) > 0),
  CONSTRAINT business_attribute_check_11 CHECK (modified_on >= created_on),
  CONSTRAINT business_attribute_check_12 CHECK (version_date IS NULL OR version IS NOT NULL),
  CONSTRAINT business_attribute_check_13 CHECK (status <> 'valid' OR num_nonnulls(description_de, description_it, description_fr, description_en) > 0),
  CONSTRAINT business_attribute_check_14 CHECK (status <> 'valid' OR value_specification IS NOT NULL)
);
COMMENT ON COLUMN catalog.business_attribute.id IS 'Internal ID. Immutable internal identity, separate from the public catalog identifier and source identifiers.';
COMMENT ON COLUMN catalog.business_attribute.identifier IS 'ID. Stable and unique within its kind. Child identifiers distinguish records across owners.';
COMMENT ON COLUMN catalog.business_attribute.row_version IS 'Edit revision. Automatically maintained edit revision; initially 1 and incremented once per committed change. Separate from catalog definition version.';
COMMENT ON COLUMN catalog.business_attribute.created_on IS 'Created. Date the catalog record was created; unknown historical dates remain unknown. Do not copy a parent date as a child assertion.';
COMMENT ON COLUMN catalog.business_attribute.modified_on IS 'Last modified. Date the catalog record last changed; not before createdOn. History and edit revision establish order. Do not copy a parent date as a child assertion.';
COMMENT ON COLUMN catalog.business_attribute.name_de IS 'Name (DE). German name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.business_attribute.name_it IS 'Name (IT). Italian name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.business_attribute.name_fr IS 'Name (FR). French name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.business_attribute.name_en IS 'Name (EN). English name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.business_attribute.description_de IS 'Description (DE). German. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid.';
COMMENT ON COLUMN catalog.business_attribute.description_it IS 'Description (IT). Italian. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid.';
COMMENT ON COLUMN catalog.business_attribute.description_fr IS 'Description (FR). French. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid.';
COMMENT ON COLUMN catalog.business_attribute.description_en IS 'Description (EN). English. Definition; preserve documented wording. At least one language value in this property family is required before status becomes valid.';
COMMENT ON COLUMN catalog.business_attribute.comment IS 'Comment. Internal note in its authored language; no translation variants, fallback or parent inheritance.';
COMMENT ON COLUMN catalog.business_attribute.documentation_links IS 'More information. Curated supporting links; deduplicate identical URL/purpose pairs.';
COMMENT ON COLUMN catalog.business_attribute.status IS 'Status. draft, valid, retired; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations.';
COMMENT ON COLUMN catalog.business_attribute.version IS 'Version. Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion.';
COMMENT ON COLUMN catalog.business_attribute.version_date IS 'Version date. Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date.';
COMMENT ON COLUMN catalog.business_attribute.responsible_organisation IS 'Responsible organisation. Inline organisation; no Actor required. Apply the documented parent fallback only when this whole value is absent.';
COMMENT ON COLUMN catalog.business_attribute.data_owner_id IS 'Data owner. Accountable person/organisation. One optional Actor; apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.business_attribute.data_steward_id IS 'Data steward. Person/organisation maintaining meaning and metadata. One optional Actor; apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.business_attribute.contact_actor_id IS 'Contact. Optional managed contact with name and website/contact page. External links may stay in responsibleOrganisation. Apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.business_attribute.classification IS 'Classification. public, internal, confidential, secret. Classification of the described information, separate from technical access.';
COMMENT ON COLUMN catalog.business_attribute.contains_personal_data IS 'Personal data. Whether the described data contains personal data. Listing a catalog contact does not establish this for the underlying dataset.';
COMMENT ON COLUMN catalog.business_attribute.business_object_id IS 'Business object. Owning business definition.';
COMMENT ON COLUMN catalog.business_attribute.semantic_name IS 'Semantic name. Stable English name, unique within the owner, for example constructionYear. Independent of localized labels.';
COMMENT ON COLUMN catalog.business_attribute.value_specification IS 'Value specification. Descriptive value type/format/unit only; required before status becomes valid. Validation rules come from qualityRequirementIds, not inline bounds or conditions.';
COMMENT ON COLUMN catalog.business_attribute.is_identifier IS 'Business identifier. Participation in business identification. Does not establish a physical key or global uniqueness.';
COMMENT ON COLUMN catalog.business_attribute.code_list_id IS 'Code list. Reviewed vocabulary; similar source wording is insufficient evidence.';

-- DataTable
CREATE TABLE catalog.data_table (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier catalog_private.identifier NOT NULL UNIQUE,
  row_version catalog_private.safe_integer NOT NULL DEFAULT 1,
  created_on date,
  modified_on date,
  name_de catalog_private.nonempty_text,
  name_it catalog_private.nonempty_text,
  name_fr catalog_private.nonempty_text,
  name_en catalog_private.nonempty_text,
  description_de catalog_private.nonempty_text,
  description_it catalog_private.nonempty_text,
  description_fr catalog_private.nonempty_text,
  description_en catalog_private.nonempty_text,
  comment catalog_private.nonempty_text,
  documentation_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text COLLATE "C" NOT NULL DEFAULT 'draft',
  version catalog_private.nonempty_text,
  version_date date,
  responsible_organisation jsonb,
  data_owner_id uuid,
  data_steward_id uuid,
  data_custodian_id uuid,
  contact_actor_id uuid,
  classification text COLLATE "C",
  contains_personal_data boolean,
  system_id uuid NOT NULL,
  domain_id uuid,
  technical_name catalog_private.nonempty_text,
  database_name catalog_private.nonempty_text,
  schema_name catalog_private.nonempty_text,
  CONSTRAINT data_table_check_1 CHECK (row_version > 0),
  CONSTRAINT data_table_check_2 CHECK (isfinite(created_on)),
  CONSTRAINT data_table_check_3 CHECK (isfinite(modified_on)),
  CONSTRAINT data_table_check_4 CHECK (catalog_private.valid_documentation_links(documentation_links)),
  CONSTRAINT data_table_check_5 CHECK (status IN ('draft', 'valid', 'retired')),
  CONSTRAINT data_table_check_6 CHECK (isfinite(version_date)),
  CONSTRAINT data_table_check_7 CHECK (catalog_private.valid_organisation(responsible_organisation)),
  CONSTRAINT data_table_check_8 CHECK (classification IN ('public', 'internal', 'confidential', 'secret')),
  CONSTRAINT data_table_check_9 CHECK (num_nonnulls(name_de, name_it, name_fr, name_en) > 0),
  CONSTRAINT data_table_check_10 CHECK (modified_on >= created_on),
  CONSTRAINT data_table_check_11 CHECK (version_date IS NULL OR version IS NOT NULL)
);
COMMENT ON COLUMN catalog.data_table.id IS 'Internal ID. Immutable internal identity, separate from the public catalog identifier and source identifiers.';
COMMENT ON COLUMN catalog.data_table.identifier IS 'ID. Stable and unique within its kind. Child identifiers distinguish records across owners.';
COMMENT ON COLUMN catalog.data_table.row_version IS 'Edit revision. Automatically maintained edit revision; initially 1 and incremented once per committed change. Separate from catalog definition version.';
COMMENT ON COLUMN catalog.data_table.created_on IS 'Created. Date the catalog record was created; unknown historical dates remain unknown.';
COMMENT ON COLUMN catalog.data_table.modified_on IS 'Last modified. Date the catalog record last changed; not before createdOn. History and edit revision establish order.';
COMMENT ON COLUMN catalog.data_table.name_de IS 'Name (DE). German name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.data_table.name_it IS 'Name (IT). Italian name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.data_table.name_fr IS 'Name (FR). French name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.data_table.name_en IS 'Name (EN). English name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.data_table.description_de IS 'Description (DE). German. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.data_table.description_it IS 'Description (IT). Italian. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.data_table.description_fr IS 'Description (FR). French. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.data_table.description_en IS 'Description (EN). English. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.data_table.comment IS 'Comment. Internal note in its authored language; no translation variants, fallback or parent inheritance.';
COMMENT ON COLUMN catalog.data_table.documentation_links IS 'More information. Curated supporting links; deduplicate identical URL/purpose pairs.';
COMMENT ON COLUMN catalog.data_table.status IS 'Status. draft, valid, retired; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations.';
COMMENT ON COLUMN catalog.data_table.version IS 'Version. Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion.';
COMMENT ON COLUMN catalog.data_table.version_date IS 'Version date. Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date.';
COMMENT ON COLUMN catalog.data_table.responsible_organisation IS 'Responsible organisation. Inline organisation; no Actor required. Apply the documented parent fallback only when this whole value is absent.';
COMMENT ON COLUMN catalog.data_table.data_owner_id IS 'Data owner. Accountable person/organisation. One optional Actor; apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.data_table.data_steward_id IS 'Data steward. Person/organisation maintaining meaning and metadata. One optional Actor; apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.data_table.data_custodian_id IS 'Data custodian. Maintains the technical source; may be a person or organisation. One explicit actor per role; missing means undocumented or inherited as specified below.';
COMMENT ON COLUMN catalog.data_table.contact_actor_id IS 'Contact. Optional managed contact with name and website/contact page. External links may stay in responsibleOrganisation. Apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.data_table.classification IS 'Classification. public, internal, confidential, secret. Classification of the described information, separate from technical access.';
COMMENT ON COLUMN catalog.data_table.contains_personal_data IS 'Personal data. Whether the described data contains personal data. Listing a catalog contact does not establish this for the underlying dataset.';
COMMENT ON COLUMN catalog.data_table.system_id IS 'System. System or source inventory documenting the structure.';
COMMENT ON COLUMN catalog.data_table.domain_id IS 'Domain. Explicit primary classification, especially without a confirmed business mapping.';
COMMENT ON COLUMN catalog.data_table.technical_name IS 'Technical name. Exact documented table, class or feature-type identifier. Never substitute an alias for an unknown physical table ID.';
COMMENT ON COLUMN catalog.data_table.database_name IS 'Database name. Exact source database name, if documented. A source system is not necessarily a database.';
COMMENT ON COLUMN catalog.data_table.schema_name IS 'Schema name. Exact source namespace/schema, if documented; no invented default schema.';

-- DataField
CREATE TABLE catalog.data_field (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier catalog_private.identifier NOT NULL UNIQUE,
  row_version catalog_private.safe_integer NOT NULL DEFAULT 1,
  created_on date,
  modified_on date,
  name_de catalog_private.nonempty_text,
  name_it catalog_private.nonempty_text,
  name_fr catalog_private.nonempty_text,
  name_en catalog_private.nonempty_text,
  description_de catalog_private.nonempty_text,
  description_it catalog_private.nonempty_text,
  description_fr catalog_private.nonempty_text,
  description_en catalog_private.nonempty_text,
  comment catalog_private.nonempty_text,
  documentation_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text COLLATE "C" NOT NULL DEFAULT 'draft',
  version catalog_private.nonempty_text,
  version_date date,
  responsible_organisation jsonb,
  data_owner_id uuid,
  data_steward_id uuid,
  data_custodian_id uuid,
  contact_actor_id uuid,
  classification text COLLATE "C",
  contains_personal_data boolean,
  data_table_id uuid NOT NULL,
  technical_name catalog_private.nonempty_text NOT NULL,
  technical_name_kind text COLLATE "C" NOT NULL,
  source_path catalog_private.nonempty_text,
  source_data_type catalog_private.nonempty_text,
  data_type_scope text COLLATE "C",
  is_required boolean,
  is_nullable boolean,
  key_roles text[] COLLATE "C",
  code_list_id uuid,
  applies_to_type_names text[] COLLATE "C" NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT data_field_check_1 CHECK (row_version > 0),
  CONSTRAINT data_field_check_2 CHECK (isfinite(created_on)),
  CONSTRAINT data_field_check_3 CHECK (isfinite(modified_on)),
  CONSTRAINT data_field_check_4 CHECK (catalog_private.valid_documentation_links(documentation_links)),
  CONSTRAINT data_field_check_5 CHECK (status IN ('draft', 'valid', 'retired')),
  CONSTRAINT data_field_check_6 CHECK (isfinite(version_date)),
  CONSTRAINT data_field_check_7 CHECK (catalog_private.valid_organisation(responsible_organisation)),
  CONSTRAINT data_field_check_8 CHECK (classification IN ('public', 'internal', 'confidential', 'secret')),
  CONSTRAINT data_field_check_9 CHECK (technical_name_kind IN ('physicalColumn', 'modelAttribute', 'apiField', 'dataSourceField', 'unknown')),
  CONSTRAINT data_field_check_10 CHECK (data_type_scope IN ('physicalSchema', 'modelDefinition', 'serviceSchema', 'unknown')),
  CONSTRAINT data_field_check_11 CHECK (catalog_private.valid_text_array(key_roles, false)),
  CONSTRAINT data_field_check_12 CHECK (key_roles <@ ARRAY['primary','foreign','unique']::text[]),
  CONSTRAINT data_field_check_13 CHECK (catalog_private.valid_text_array(applies_to_type_names, false)),
  CONSTRAINT data_field_check_14 CHECK (num_nonnulls(name_de, name_it, name_fr, name_en) > 0),
  CONSTRAINT data_field_check_15 CHECK (modified_on >= created_on),
  CONSTRAINT data_field_check_16 CHECK (version_date IS NULL OR version IS NOT NULL),
  CONSTRAINT data_field_check_17 CHECK ((source_data_type IS NULL) = (data_type_scope IS NULL))
);
COMMENT ON COLUMN catalog.data_field.id IS 'Internal ID. Immutable internal identity, separate from the public catalog identifier and source identifiers.';
COMMENT ON COLUMN catalog.data_field.identifier IS 'ID. Stable and unique within its kind. Child identifiers distinguish records across owners.';
COMMENT ON COLUMN catalog.data_field.row_version IS 'Edit revision. Automatically maintained edit revision; initially 1 and incremented once per committed change. Separate from catalog definition version.';
COMMENT ON COLUMN catalog.data_field.created_on IS 'Created. Date the catalog record was created; unknown historical dates remain unknown. Do not copy a parent date as a child assertion.';
COMMENT ON COLUMN catalog.data_field.modified_on IS 'Last modified. Date the catalog record last changed; not before createdOn. History and edit revision establish order. Do not copy a parent date as a child assertion.';
COMMENT ON COLUMN catalog.data_field.name_de IS 'Name (DE). German name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.data_field.name_it IS 'Name (IT). Italian name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.data_field.name_fr IS 'Name (FR). French name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.data_field.name_en IS 'Name (EN). English name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.data_field.description_de IS 'Description (DE). German. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.data_field.description_it IS 'Description (IT). Italian. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.data_field.description_fr IS 'Description (FR). French. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.data_field.description_en IS 'Description (EN). English. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.data_field.comment IS 'Comment. Internal note in its authored language; no translation variants, fallback or parent inheritance.';
COMMENT ON COLUMN catalog.data_field.documentation_links IS 'More information. Curated supporting links; deduplicate identical URL/purpose pairs.';
COMMENT ON COLUMN catalog.data_field.status IS 'Status. draft, valid, retired; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations.';
COMMENT ON COLUMN catalog.data_field.version IS 'Version. Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion.';
COMMENT ON COLUMN catalog.data_field.version_date IS 'Version date. Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date.';
COMMENT ON COLUMN catalog.data_field.responsible_organisation IS 'Responsible organisation. Inline organisation; no Actor required. Apply the documented parent fallback only when this whole value is absent.';
COMMENT ON COLUMN catalog.data_field.data_owner_id IS 'Data owner. Accountable person/organisation. One optional Actor; apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.data_field.data_steward_id IS 'Data steward. Person/organisation maintaining meaning and metadata. One optional Actor; apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.data_field.data_custodian_id IS 'Data custodian. Maintains the technical source; may be a person or organisation. One explicit actor per role; missing means undocumented or inherited as specified below.';
COMMENT ON COLUMN catalog.data_field.contact_actor_id IS 'Contact. Optional managed contact with name and website/contact page. External links may stay in responsibleOrganisation. Apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.data_field.classification IS 'Classification. public, internal, confidential, secret. Classification of the described information, separate from technical access.';
COMMENT ON COLUMN catalog.data_field.contains_personal_data IS 'Personal data. Whether the described data contains personal data. Listing a catalog contact does not establish this for the underlying dataset.';
COMMENT ON COLUMN catalog.data_field.data_table_id IS 'Data table. Owning technical structure.';
COMMENT ON COLUMN catalog.data_field.technical_name IS 'Technical name. Exact documented source field name, preserving case. Never translated.';
COMMENT ON COLUMN catalog.data_field.technical_name_kind IS 'Technical name kind. physicalColumn, modelAttribute, apiField, dataSourceField, unknown.';
COMMENT ON COLUMN catalog.data_field.source_path IS 'Source path. Documented nesting or path context when the name is ambiguous. Not a guessed flattened column.';
COMMENT ON COLUMN catalog.data_field.source_data_type IS 'Data type. Exact reported type, including documented length/precision.';
COMMENT ON COLUMN catalog.data_field.data_type_scope IS 'Data type scope. physicalSchema, modelDefinition, serviceSchema, unknown; required when sourceDataType is present, otherwise absent. Use unknown when a documented type has no established scope.';
COMMENT ON COLUMN catalog.data_field.is_required IS 'Mandatory. Documented presence requirement in the stated source scope. Not inherited from the business definition.';
COMMENT ON COLUMN catalog.data_field.is_nullable IS 'Nullable. Whether explicit null is permitted. Distinct from whether the field may be absent.';
COMMENT ON COLUMN catalog.data_field.key_roles IS 'Key. primary, foreign, unique. An absent value means unknown; an empty set means reviewed with no documented role. Never treat an unknown key set as a confirmed empty set. Composite-key membership does not make a field individually unique.  Describes source-data keys; not a catalog key.';
COMMENT ON COLUMN catalog.data_field.code_list_id IS 'Code list. Verified source vocabulary; never infer service wire codes from a similarly named model enumeration.';
COMMENT ON COLUMN catalog.data_field.applies_to_type_names IS 'Applies to model types. Exact documented source type names using the field; descriptive text, not references to a catalog type registry. Use the documented source declaration to establish membership. The DataTable has no stored type set.';

-- DataProduct
CREATE TABLE catalog.data_product (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier catalog_private.identifier NOT NULL UNIQUE,
  row_version catalog_private.safe_integer NOT NULL DEFAULT 1,
  created_on date,
  modified_on date,
  name_de catalog_private.nonempty_text,
  name_it catalog_private.nonempty_text,
  name_fr catalog_private.nonempty_text,
  name_en catalog_private.nonempty_text,
  description_de catalog_private.nonempty_text,
  description_it catalog_private.nonempty_text,
  description_fr catalog_private.nonempty_text,
  description_en catalog_private.nonempty_text,
  comment catalog_private.nonempty_text,
  documentation_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text COLLATE "C" NOT NULL DEFAULT 'draft',
  version catalog_private.nonempty_text,
  version_date date,
  responsible_organisation jsonb,
  data_owner_id uuid,
  data_steward_id uuid,
  contact_actor_id uuid,
  classification text COLLATE "C",
  contains_personal_data boolean,
  domain_id uuid,
  access_mode text COLLATE "C",
  access_notes catalog_private.nonempty_text,
  landing_page_url catalog_private.http_url,
  formats text[] COLLATE "C" NOT NULL DEFAULT '{}'::text[],
  license_uri catalog_private.http_url,
  license_notes catalog_private.nonempty_text,
  update_frequency text COLLATE "C",
  CONSTRAINT data_product_check_1 CHECK (row_version > 0),
  CONSTRAINT data_product_check_2 CHECK (isfinite(created_on)),
  CONSTRAINT data_product_check_3 CHECK (isfinite(modified_on)),
  CONSTRAINT data_product_check_4 CHECK (catalog_private.valid_documentation_links(documentation_links)),
  CONSTRAINT data_product_check_5 CHECK (status IN ('draft', 'valid', 'retired')),
  CONSTRAINT data_product_check_6 CHECK (isfinite(version_date)),
  CONSTRAINT data_product_check_7 CHECK (catalog_private.valid_organisation(responsible_organisation)),
  CONSTRAINT data_product_check_8 CHECK (classification IN ('public', 'internal', 'confidential', 'secret')),
  CONSTRAINT data_product_check_9 CHECK (access_mode IN ('public', 'internal', 'restricted')),
  CONSTRAINT data_product_check_10 CHECK (catalog_private.valid_text_array(formats, false)),
  CONSTRAINT data_product_check_11 CHECK (update_frequency IN ('continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'onChange', 'onDemand', 'irregular')),
  CONSTRAINT data_product_check_12 CHECK (num_nonnulls(name_de, name_it, name_fr, name_en) > 0),
  CONSTRAINT data_product_check_13 CHECK (modified_on >= created_on),
  CONSTRAINT data_product_check_14 CHECK (version_date IS NULL OR version IS NOT NULL)
);
COMMENT ON COLUMN catalog.data_product.id IS 'Internal ID. Immutable internal identity, separate from the public catalog identifier and source identifiers.';
COMMENT ON COLUMN catalog.data_product.identifier IS 'ID. Stable and unique within its kind. Child identifiers distinguish records across owners.';
COMMENT ON COLUMN catalog.data_product.row_version IS 'Edit revision. Automatically maintained edit revision; initially 1 and incremented once per committed change. Separate from catalog definition version.';
COMMENT ON COLUMN catalog.data_product.created_on IS 'Created. Date the catalog record was created; unknown historical dates remain unknown.';
COMMENT ON COLUMN catalog.data_product.modified_on IS 'Last modified. Date the catalog record last changed; not before createdOn. History and edit revision establish order.';
COMMENT ON COLUMN catalog.data_product.name_de IS 'Name (DE). German name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.data_product.name_it IS 'Name (IT). Italian name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.data_product.name_fr IS 'Name (FR). French name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.data_product.name_en IS 'Name (EN). English name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.data_product.description_de IS 'Description (DE). German. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.data_product.description_it IS 'Description (IT). Italian. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.data_product.description_fr IS 'Description (FR). French. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.data_product.description_en IS 'Description (EN). English. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.data_product.comment IS 'Comment. Internal note in its authored language; no translation variants, fallback or parent inheritance.';
COMMENT ON COLUMN catalog.data_product.documentation_links IS 'More information. Curated supporting links; deduplicate identical URL/purpose pairs.';
COMMENT ON COLUMN catalog.data_product.status IS 'Status. draft, valid, retired; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations.';
COMMENT ON COLUMN catalog.data_product.version IS 'Version. Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion.';
COMMENT ON COLUMN catalog.data_product.version_date IS 'Version date. Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date.';
COMMENT ON COLUMN catalog.data_product.responsible_organisation IS 'Responsible organisation. Inline organisation; no Actor required. Apply the documented parent fallback only when this whole value is absent.';
COMMENT ON COLUMN catalog.data_product.data_owner_id IS 'Data owner. Accountable person/organisation. One optional Actor; apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.data_product.data_steward_id IS 'Data steward. Person/organisation maintaining meaning and metadata. One optional Actor; apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.data_product.contact_actor_id IS 'Contact. Optional managed contact with name and website/contact page. External links may stay in responsibleOrganisation. Apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.data_product.classification IS 'Classification. public, internal, confidential, secret. Classification of the described information, separate from technical access.';
COMMENT ON COLUMN catalog.data_product.contains_personal_data IS 'Personal data. Whether the described data contains personal data. Listing a catalog contact does not establish this for the underlying dataset.';
COMMENT ON COLUMN catalog.data_product.domain_id IS 'Domain. Primary business classification.';
COMMENT ON COLUMN catalog.data_product.access_mode IS 'Access. public, internal, restricted; separate from authentication configuration.';
COMMENT ON COLUMN catalog.data_product.access_notes IS 'Access notes. Who may obtain the product and under what conditions. One value in its authored language; no translation variants or fallback.';
COMMENT ON COLUMN catalog.data_product.landing_page_url IS 'Information page. Documented product information/access page; no placeholder destination.';
COMMENT ON COLUMN catalog.data_product.formats IS 'Format. Documented product format names or media types; preserve exact tokens and do not guess a standard vocabulary URI.';
COMMENT ON COLUMN catalog.data_product.license_uri IS 'License. Identified product usage terms. Missing does not imply open reuse.';
COMMENT ON COLUMN catalog.data_product.license_notes IS 'License notes. Documented usage terms in their authored language, including unresolved legacy licence text. One value; no language variants or fallback.';
COMMENT ON COLUMN catalog.data_product.update_frequency IS 'Update frequency. continuous, daily, weekly, monthly, quarterly, annually, onChange, onDemand, irregular. Product commitment, not evidence of actual data freshness.';

-- ProductAttribute
CREATE TABLE catalog.product_attribute (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier catalog_private.identifier NOT NULL UNIQUE,
  row_version catalog_private.safe_integer NOT NULL DEFAULT 1,
  created_on date,
  modified_on date,
  name_de catalog_private.nonempty_text,
  name_it catalog_private.nonempty_text,
  name_fr catalog_private.nonempty_text,
  name_en catalog_private.nonempty_text,
  description_de catalog_private.nonempty_text,
  description_it catalog_private.nonempty_text,
  description_fr catalog_private.nonempty_text,
  description_en catalog_private.nonempty_text,
  comment catalog_private.nonempty_text,
  documentation_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_product_id uuid NOT NULL,
  semantic_name catalog_private.identifier NOT NULL,
  business_attribute_id uuid,
  value_specification jsonb,
  is_required boolean,
  UNIQUE (data_product_id, semantic_name),
  CONSTRAINT product_attribute_check_1 CHECK (row_version > 0),
  CONSTRAINT product_attribute_check_2 CHECK (isfinite(created_on)),
  CONSTRAINT product_attribute_check_3 CHECK (isfinite(modified_on)),
  CONSTRAINT product_attribute_check_4 CHECK (catalog_private.valid_documentation_links(documentation_links)),
  CONSTRAINT product_attribute_check_5 CHECK (catalog_private.valid_value_specification(value_specification, false)),
  CONSTRAINT product_attribute_check_6 CHECK (num_nonnulls(name_de, name_it, name_fr, name_en) > 0),
  CONSTRAINT product_attribute_check_7 CHECK (modified_on >= created_on)
);
COMMENT ON COLUMN catalog.product_attribute.id IS 'Internal ID. Immutable internal identity, separate from the public catalog identifier and source identifiers.';
COMMENT ON COLUMN catalog.product_attribute.identifier IS 'ID. Stable and unique within its kind. Child identifiers distinguish records across owners.';
COMMENT ON COLUMN catalog.product_attribute.row_version IS 'Edit revision. Automatically maintained edit revision; initially 1 and incremented once per committed change. Separate from catalog definition version.';
COMMENT ON COLUMN catalog.product_attribute.created_on IS 'Created. Date the catalog record was created; unknown historical dates remain unknown.';
COMMENT ON COLUMN catalog.product_attribute.modified_on IS 'Last modified. Date the catalog record last changed; not before createdOn. History and edit revision establish order.';
COMMENT ON COLUMN catalog.product_attribute.name_de IS 'Name (DE). German name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.product_attribute.name_it IS 'Name (IT). Italian name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.product_attribute.name_fr IS 'Name (FR). French name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.product_attribute.name_en IS 'Name (EN). English name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.product_attribute.description_de IS 'Description (DE). German. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.product_attribute.description_it IS 'Description (IT). Italian. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.product_attribute.description_fr IS 'Description (FR). French. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.product_attribute.description_en IS 'Description (EN). English. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.product_attribute.comment IS 'Comment. Internal note in its authored language; no translation variants, fallback or parent inheritance.';
COMMENT ON COLUMN catalog.product_attribute.documentation_links IS 'More information. Curated supporting links; deduplicate identical URL/purpose pairs.';
COMMENT ON COLUMN catalog.product_attribute.data_product_id IS 'Data product. Owning product contract.';
COMMENT ON COLUMN catalog.product_attribute.semantic_name IS 'Semantic name. Stable English name, unique within the product.';
COMMENT ON COLUMN catalog.product_attribute.business_attribute_id IS 'Business attribute. Reviewed business meaning when correspondence is direct.';
COMMENT ON COLUMN catalog.product_attribute.value_specification IS 'Value specification. Value format and constraints promised by the product.';
COMMENT ON COLUMN catalog.product_attribute.is_required IS 'Mandatory. Requiredness in the product contract; absence is unknown.';

-- DataService
CREATE TABLE catalog.data_service (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier catalog_private.identifier NOT NULL UNIQUE,
  row_version catalog_private.safe_integer NOT NULL DEFAULT 1,
  created_on date,
  modified_on date,
  name_de catalog_private.nonempty_text,
  name_it catalog_private.nonempty_text,
  name_fr catalog_private.nonempty_text,
  name_en catalog_private.nonempty_text,
  description_de catalog_private.nonempty_text,
  description_it catalog_private.nonempty_text,
  description_fr catalog_private.nonempty_text,
  description_en catalog_private.nonempty_text,
  comment catalog_private.nonempty_text,
  documentation_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text COLLATE "C" NOT NULL DEFAULT 'draft',
  version catalog_private.nonempty_text,
  version_date date,
  responsible_organisation jsonb,
  data_owner_id uuid,
  data_steward_id uuid,
  data_custodian_id uuid,
  contact_actor_id uuid,
  classification text COLLATE "C",
  contains_personal_data boolean,
  system_id uuid,
  domain_id uuid,
  technical_name catalog_private.nonempty_text,
  service_version catalog_private.nonempty_text,
  purpose text COLLATE "C",
  access_mode text COLLATE "C",
  access_notes catalog_private.nonempty_text,
  endpoint_description_urls text[] COLLATE "C" NOT NULL DEFAULT '{}'::text[],
  CONSTRAINT data_service_check_1 CHECK (row_version > 0),
  CONSTRAINT data_service_check_2 CHECK (isfinite(created_on)),
  CONSTRAINT data_service_check_3 CHECK (isfinite(modified_on)),
  CONSTRAINT data_service_check_4 CHECK (catalog_private.valid_documentation_links(documentation_links)),
  CONSTRAINT data_service_check_5 CHECK (status IN ('draft', 'valid', 'retired')),
  CONSTRAINT data_service_check_6 CHECK (isfinite(version_date)),
  CONSTRAINT data_service_check_7 CHECK (catalog_private.valid_organisation(responsible_organisation)),
  CONSTRAINT data_service_check_8 CHECK (classification IN ('public', 'internal', 'confidential', 'secret')),
  CONSTRAINT data_service_check_9 CHECK (purpose IN ('recordAccess', 'featureAccess', 'mapImage', 'download', 'mixed')),
  CONSTRAINT data_service_check_10 CHECK (access_mode IN ('public', 'internal', 'restricted')),
  CONSTRAINT data_service_check_11 CHECK (catalog_private.valid_text_array(endpoint_description_urls, true)),
  CONSTRAINT data_service_check_12 CHECK (num_nonnulls(name_de, name_it, name_fr, name_en) > 0),
  CONSTRAINT data_service_check_13 CHECK (modified_on >= created_on),
  CONSTRAINT data_service_check_14 CHECK (version_date IS NULL OR version IS NOT NULL)
);
COMMENT ON COLUMN catalog.data_service.id IS 'Internal ID. Immutable internal identity, separate from the public catalog identifier and source identifiers.';
COMMENT ON COLUMN catalog.data_service.identifier IS 'ID. Stable and unique within its kind. Child identifiers distinguish records across owners.';
COMMENT ON COLUMN catalog.data_service.row_version IS 'Edit revision. Automatically maintained edit revision; initially 1 and incremented once per committed change. Separate from catalog definition version.';
COMMENT ON COLUMN catalog.data_service.created_on IS 'Created. Date the catalog record was created; unknown historical dates remain unknown.';
COMMENT ON COLUMN catalog.data_service.modified_on IS 'Last modified. Date the catalog record last changed; not before createdOn. History and edit revision establish order.';
COMMENT ON COLUMN catalog.data_service.name_de IS 'Name (DE). German name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.data_service.name_it IS 'Name (IT). Italian name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.data_service.name_fr IS 'Name (FR). French name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.data_service.name_en IS 'Name (EN). English name; at least one language is required. Not an identifier.';
COMMENT ON COLUMN catalog.data_service.description_de IS 'Description (DE). German. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.data_service.description_it IS 'Description (IT). Italian. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.data_service.description_fr IS 'Description (FR). French. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.data_service.description_en IS 'Description (EN). English. Definition; preserve documented wording.';
COMMENT ON COLUMN catalog.data_service.comment IS 'Comment. Internal note in its authored language; no translation variants, fallback or parent inheritance.';
COMMENT ON COLUMN catalog.data_service.documentation_links IS 'More information. Curated supporting links; deduplicate identical URL/purpose pairs.';
COMMENT ON COLUMN catalog.data_service.status IS 'Status. draft, valid, retired; new records default to draft. Status changes are manual and audited; source publication alone does not establish the correctness of local interpretations.';
COMMENT ON COLUMN catalog.data_service.version IS 'Version. Catalog definition version, if managed; paired with versionDate. Separate from source editions, serviceVersion and the technical rowVersion.';
COMMENT ON COLUMN catalog.data_service.version_date IS 'Version date. Date this catalog definition version was issued. Required for a newly assigned/changed version; absent without version. Preserve unknown legacy dates. Not an import, last-edit or service-release date.';
COMMENT ON COLUMN catalog.data_service.responsible_organisation IS 'Responsible organisation. Inline organisation; no Actor required. Apply the documented parent fallback only when this whole value is absent.';
COMMENT ON COLUMN catalog.data_service.data_owner_id IS 'Data owner. Accountable person/organisation. One optional Actor; apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.data_service.data_steward_id IS 'Data steward. Person/organisation maintaining meaning and metadata. One optional Actor; apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.data_service.data_custodian_id IS 'Data custodian. Maintains the technical source; may be a person or organisation. One explicit actor per role; missing means undocumented or inherited as specified below.';
COMMENT ON COLUMN catalog.data_service.contact_actor_id IS 'Contact. Optional managed contact with name and website/contact page. External links may stay in responsibleOrganisation. Apply only the documented parent fallback.';
COMMENT ON COLUMN catalog.data_service.classification IS 'Classification. public, internal, confidential, secret. Classification of the described information, separate from technical access.';
COMMENT ON COLUMN catalog.data_service.contains_personal_data IS 'Personal data. Whether the described data contains personal data. Listing a catalog contact does not establish this for the underlying dataset.';
COMMENT ON COLUMN catalog.data_service.system_id IS 'System. Providing system, if identified. External services need no invented system assignment.';
COMMENT ON COLUMN catalog.data_service.domain_id IS 'Domain. Primary catalog classification.';
COMMENT ON COLUMN catalog.data_service.technical_name IS 'Technical name. Official interface identifier.';
COMMENT ON COLUMN catalog.data_service.service_version IS 'Service version. Source interface release, separate from catalog version.';
COMMENT ON COLUMN catalog.data_service.purpose IS 'Purpose. recordAccess, featureAccess, mapImage, download, mixed. Map display does not imply polygon extraction.';
COMMENT ON COLUMN catalog.data_service.access_mode IS 'Access. public, internal, restricted.';
COMMENT ON COLUMN catalog.data_service.access_notes IS 'Access notes. Access restrictions and limitations. One value in its authored language; no translation variants or fallback.';
COMMENT ON COLUMN catalog.data_service.endpoint_description_urls IS 'Interface descriptions. Machine-readable interface descriptions, such as OpenAPI, WSDL or capabilities documents. Human help pages stay in DocumentationLink.';

-- Relationship
CREATE TABLE catalog.relationship (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier catalog_private.identifier NOT NULL UNIQUE,
  row_version catalog_private.safe_integer NOT NULL DEFAULT 1,
  created_on date,
  modified_on date,
  source_business_object_id uuid,
  source_data_product_id uuid,
  source_data_table_id uuid,
  source_data_field_id uuid,
  source_data_service_id uuid,
  target_business_object_id uuid,
  target_business_attribute_id uuid,
  target_data_table_id uuid,
  target_data_field_id uuid,
  target_data_service_id uuid,
  relationship_type text COLLATE "C" NOT NULL,
  comment catalog_private.nonempty_text,
  source_endpoint_id uuid,
  verification_status text COLLATE "C" NOT NULL DEFAULT 'candidate',
  coverage text COLLATE "C",
  support_status text COLLATE "C",
  assessed_service_version catalog_private.nonempty_text,
  rule_notes_de catalog_private.nonempty_text,
  rule_notes_it catalog_private.nonempty_text,
  rule_notes_fr catalog_private.nonempty_text,
  rule_notes_en catalog_private.nonempty_text,
  documentation_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT relationship_check_1 CHECK (row_version > 0),
  CONSTRAINT relationship_check_2 CHECK (isfinite(created_on)),
  CONSTRAINT relationship_check_3 CHECK (isfinite(modified_on)),
  CONSTRAINT relationship_check_4 CHECK (num_nonnulls(source_business_object_id, source_data_product_id, source_data_table_id, source_data_field_id, source_data_service_id) = 1),
  CONSTRAINT relationship_check_5 CHECK (num_nonnulls(target_business_object_id, target_business_attribute_id, target_data_table_id, target_data_field_id, target_data_service_id) = 1),
  CONSTRAINT relationship_check_6 CHECK (relationship_type IN ('realizes', 'represents', 'correspondsTo', 'exposes', 'assesses', 'basedOn', 'sourcedFrom', 'servedBy', 'measuredFor')),
  CONSTRAINT relationship_check_7 CHECK (verification_status IN ('candidate', 'confirmed', 'rejected', 'obsolete')),
  CONSTRAINT relationship_check_8 CHECK (coverage IN ('full', 'partial', 'unknown')),
  CONSTRAINT relationship_check_9 CHECK (support_status IN ('notAssessed', 'supported', 'partial', 'missing')),
  CONSTRAINT relationship_check_10 CHECK (catalog_private.valid_documentation_links(documentation_links)),
  CONSTRAINT relationship_check_11 CHECK (modified_on >= created_on),
  CONSTRAINT relationship_check_12 CHECK (((relationship_type = 'realizes' AND source_data_table_id IS NOT NULL AND target_business_object_id IS NOT NULL)
      OR (relationship_type = 'represents' AND source_data_field_id IS NOT NULL AND target_business_attribute_id IS NOT NULL)
      OR (relationship_type = 'correspondsTo' AND source_data_field_id IS NOT NULL AND target_data_field_id IS NOT NULL)
      OR (relationship_type = 'exposes' AND source_data_service_id IS NOT NULL AND target_data_table_id IS NOT NULL)
      OR (relationship_type = 'exposes' AND source_data_service_id IS NOT NULL AND target_data_field_id IS NOT NULL)
      OR (relationship_type = 'assesses' AND source_data_service_id IS NOT NULL AND target_business_attribute_id IS NOT NULL)
      OR (relationship_type = 'basedOn' AND source_data_product_id IS NOT NULL AND target_business_object_id IS NOT NULL)
      OR (relationship_type = 'sourcedFrom' AND source_data_product_id IS NOT NULL AND target_data_table_id IS NOT NULL)
      OR (relationship_type = 'servedBy' AND source_data_product_id IS NOT NULL AND target_data_service_id IS NOT NULL)
      OR (relationship_type = 'measuredFor' AND source_business_object_id IS NOT NULL AND target_business_object_id IS NOT NULL))),
  CONSTRAINT relationship_check_13 CHECK (source_data_field_id <> target_data_field_id),
  CONSTRAINT relationship_check_14 CHECK (source_business_object_id <> target_business_object_id),
  CONSTRAINT relationship_check_15 CHECK ((relationship_type IN ('realizes','represents','correspondsTo','exposes')) = (coverage IS NOT NULL)),
  CONSTRAINT relationship_check_16 CHECK ((relationship_type = 'assesses') = (support_status IS NOT NULL)),
  CONSTRAINT relationship_check_17 CHECK ((relationship_type = 'assesses' AND source_endpoint_id IS NOT NULL) OR relationship_type = 'exposes' OR (relationship_type NOT IN ('assesses','exposes') AND source_endpoint_id IS NULL)),
  CONSTRAINT relationship_check_18 CHECK (relationship_type IN ('exposes','assesses') OR assessed_service_version IS NULL),
  CONSTRAINT relationship_check_19 CHECK (relationship_type <> 'assesses' OR verification_status <> 'confirmed' OR support_status <> 'notAssessed'),
  CONSTRAINT relationship_check_20 CHECK ((coverage IS DISTINCT FROM 'partial' AND coalesce(support_status NOT IN ('partial','missing'), true)) OR num_nonnulls(rule_notes_de, rule_notes_it, rule_notes_fr, rule_notes_en) > 0),
  CONSTRAINT relationship_check_21 CHECK (verification_status <> 'confirmed' OR num_nonnulls(rule_notes_de, rule_notes_it, rule_notes_fr, rule_notes_en) > 0 OR jsonb_array_length(documentation_links) > 0)
);
COMMENT ON COLUMN catalog.relationship.id IS 'Internal ID. Immutable internal identity, separate from the public catalog identifier and source identifiers.';
COMMENT ON COLUMN catalog.relationship.identifier IS 'ID. Stable and unique within its kind. Child identifiers distinguish records across owners.';
COMMENT ON COLUMN catalog.relationship.row_version IS 'Edit revision. Automatically maintained edit revision; initially 1 and incremented once per committed change. Separate from catalog definition version.';
COMMENT ON COLUMN catalog.relationship.created_on IS 'Created. Date the catalog record was created; unknown historical dates remain unknown.';
COMMENT ON COLUMN catalog.relationship.modified_on IS 'Last modified. Date the catalog record last changed; not before createdOn. History and edit revision establish order.';
COMMENT ON COLUMN catalog.relationship.relationship_type IS 'Relationship type. Controlled English token from the signature table below.';
COMMENT ON COLUMN catalog.relationship.comment IS 'Comment. Optional internal explanation, stored once without translation or language fallback.';
COMMENT ON COLUMN catalog.relationship.verification_status IS 'Verification status. candidate, confirmed, rejected, obsolete; defaults to candidate. This is the sole relationship review lifecycle. Rejected/obsolete records remain available in history and review tools.';
COMMENT ON COLUMN catalog.relationship.coverage IS 'Coverage. full, partial, unknown; required for realizes, represents, correspondsTo and exposes, absent for all other relationship types. Describes source coverage of the documented target scope; partial needs a rule note.';
COMMENT ON COLUMN catalog.relationship.support_status IS 'Requirement support. For assesses only: notAssessed, supported, partial, missing. Required for that type; confirmed requires a value other than notAssessed.';
COMMENT ON COLUMN catalog.relationship.assessed_service_version IS 'Assessed service version. Exact source service release assessed for exposes/assesses; absent for other types. Required when known; never invented. Evidence must identify its documentation scope even when no release number exists.';
COMMENT ON COLUMN catalog.relationship.rule_notes_de IS 'Rule notes (DE). German. Scope limits, semantic differences or the capability gap. At least one ruleNotes language value is required for partial/missing support or partial coverage. No executable code.';
COMMENT ON COLUMN catalog.relationship.rule_notes_it IS 'Rule notes (IT). Italian. Scope limits, semantic differences or the capability gap. At least one ruleNotes language value is required for partial/missing support or partial coverage. No executable code.';
COMMENT ON COLUMN catalog.relationship.rule_notes_fr IS 'Rule notes (FR). French. Scope limits, semantic differences or the capability gap. At least one ruleNotes language value is required for partial/missing support or partial coverage. No executable code.';
COMMENT ON COLUMN catalog.relationship.rule_notes_en IS 'Rule notes (EN). English. Scope limits, semantic differences or the capability gap. At least one ruleNotes language value is required for partial/missing support or partial coverage. No executable code.';
COMMENT ON COLUMN catalog.relationship.documentation_links IS 'More information. Supporting documentation for the scoped assertion. Deduplicate URL/purpose pairs; confirmation also needs the review and scope notes below.';

-- LineageRelation
CREATE TABLE catalog.lineage_relation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier catalog_private.identifier NOT NULL UNIQUE,
  row_version catalog_private.safe_integer NOT NULL DEFAULT 1,
  created_on date,
  modified_on date,
  source_data_table_id uuid,
  source_data_field_id uuid,
  target_data_table_id uuid,
  target_data_field_id uuid,
  operation text COLLATE "C" NOT NULL,
  transformation_notes_de catalog_private.nonempty_text,
  transformation_notes_it catalog_private.nonempty_text,
  transformation_notes_fr catalog_private.nonempty_text,
  transformation_notes_en catalog_private.nonempty_text,
  verification_status text COLLATE "C" NOT NULL DEFAULT 'candidate',
  documentation_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT lineage_relation_check_1 CHECK (row_version > 0),
  CONSTRAINT lineage_relation_check_2 CHECK (isfinite(created_on)),
  CONSTRAINT lineage_relation_check_3 CHECK (isfinite(modified_on)),
  CONSTRAINT lineage_relation_check_4 CHECK (num_nonnulls(source_data_table_id, source_data_field_id) = 1),
  CONSTRAINT lineage_relation_check_5 CHECK (num_nonnulls(target_data_table_id, target_data_field_id) = 1),
  CONSTRAINT lineage_relation_check_6 CHECK (operation IN ('copy', 'transform', 'aggregate', 'unknown')),
  CONSTRAINT lineage_relation_check_7 CHECK (verification_status IN ('candidate', 'confirmed', 'rejected', 'obsolete')),
  CONSTRAINT lineage_relation_check_8 CHECK (catalog_private.valid_documentation_links(documentation_links)),
  CONSTRAINT lineage_relation_check_9 CHECK (modified_on >= created_on),
  CONSTRAINT lineage_relation_check_10 CHECK (((source_data_table_id IS NOT NULL AND target_data_table_id IS NOT NULL AND source_data_table_id <> target_data_table_id) OR (source_data_field_id IS NOT NULL AND target_data_field_id IS NOT NULL AND source_data_field_id <> target_data_field_id))),
  CONSTRAINT lineage_relation_check_11 CHECK (verification_status <> 'confirmed' OR num_nonnulls(transformation_notes_de, transformation_notes_it, transformation_notes_fr, transformation_notes_en) > 0 OR jsonb_array_length(documentation_links) > 0),
  CONSTRAINT lineage_relation_check_12 CHECK (verification_status <> 'confirmed' OR operation NOT IN ('transform','aggregate') OR num_nonnulls(transformation_notes_de, transformation_notes_it, transformation_notes_fr, transformation_notes_en) > 0)
);
COMMENT ON COLUMN catalog.lineage_relation.id IS 'Internal ID. Immutable internal identity, separate from the public catalog identifier and source identifiers.';
COMMENT ON COLUMN catalog.lineage_relation.identifier IS 'ID. Stable and unique within its kind. Child identifiers distinguish records across owners.';
COMMENT ON COLUMN catalog.lineage_relation.row_version IS 'Edit revision. Automatically maintained edit revision; initially 1 and incremented once per committed change. Separate from catalog definition version.';
COMMENT ON COLUMN catalog.lineage_relation.created_on IS 'Created. Date the catalog record was created; unknown historical dates remain unknown.';
COMMENT ON COLUMN catalog.lineage_relation.modified_on IS 'Last modified. Date the catalog record last changed; not before createdOn. History and edit revision establish order.';
COMMENT ON COLUMN catalog.lineage_relation.operation IS 'Operation. copy, transform, aggregate, unknown. A documented dependency may have an unknown operation; do not infer copy from similar names.';
COMMENT ON COLUMN catalog.lineage_relation.transformation_notes_de IS 'Transformation notes (DE). German. Documented derivation and scope. At least one note is required for confirmed transform or aggregate relations. No executable expression is assumed.';
COMMENT ON COLUMN catalog.lineage_relation.transformation_notes_it IS 'Transformation notes (IT). Italian. Documented derivation and scope. At least one note is required for confirmed transform or aggregate relations. No executable expression is assumed.';
COMMENT ON COLUMN catalog.lineage_relation.transformation_notes_fr IS 'Transformation notes (FR). French. Documented derivation and scope. At least one note is required for confirmed transform or aggregate relations. No executable expression is assumed.';
COMMENT ON COLUMN catalog.lineage_relation.transformation_notes_en IS 'Transformation notes (EN). English. Documented derivation and scope. At least one note is required for confirmed transform or aggregate relations. No executable expression is assumed.';
COMMENT ON COLUMN catalog.lineage_relation.verification_status IS 'Verification status. candidate, confirmed, rejected, obsolete; new records default to candidate. Confirmation requires a documented basis in transformation notes and/or documentationLinks, an explicit verification-state edit recorded in ChangeEvent.';
COMMENT ON COLUMN catalog.lineage_relation.documentation_links IS 'More information. Supporting documentation for the scoped assertion. Deduplicate URL/purpose pairs; confirmation also needs the review and scope notes below.';

-- ChangeEvent
CREATE TABLE catalog.change_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier catalog_private.identifier NOT NULL UNIQUE,
  record_actor_id uuid,
  record_domain_id uuid,
  record_system_id uuid,
  record_business_object_id uuid,
  record_code_list_id uuid,
  record_code_value_id uuid,
  record_quality_requirement_id uuid,
  record_business_attribute_id uuid,
  record_data_table_id uuid,
  record_data_field_id uuid,
  record_data_product_id uuid,
  record_product_attribute_id uuid,
  record_data_service_id uuid,
  record_relationship_id uuid,
  record_lineage_relation_id uuid,
  occurred_on date NOT NULL,
  occurred_at timestamptz,
  action text COLLATE "C" NOT NULL,
  actor_id uuid,
  actor_name_de catalog_private.nonempty_text,
  actor_name_it catalog_private.nonempty_text,
  actor_name_fr catalog_private.nonempty_text,
  actor_name_en catalog_private.nonempty_text,
  summary_de catalog_private.nonempty_text,
  summary_it catalog_private.nonempty_text,
  summary_fr catalog_private.nonempty_text,
  summary_en catalog_private.nonempty_text,
  changed_properties text[] COLLATE "C" NOT NULL DEFAULT '{}'::text[],
  before jsonb,
  after jsonb,
  import_id catalog_private.identifier,
  CONSTRAINT change_event_check_1 CHECK (num_nonnulls(record_actor_id, record_domain_id, record_system_id, record_business_object_id, record_code_list_id, record_code_value_id, record_quality_requirement_id, record_business_attribute_id, record_data_table_id, record_data_field_id, record_data_product_id, record_product_attribute_id, record_data_service_id, record_relationship_id, record_lineage_relation_id) = 1),
  CONSTRAINT change_event_check_2 CHECK (isfinite(occurred_on)),
  CONSTRAINT change_event_check_3 CHECK (isfinite(occurred_at)),
  CONSTRAINT change_event_check_4 CHECK (action IN ('created', 'updated', 'imported', 'retired', 'restored')),
  CONSTRAINT change_event_check_5 CHECK (catalog_private.valid_text_array(changed_properties, false)),
  CONSTRAINT change_event_check_6 CHECK (jsonb_typeof(before) = 'object'),
  CONSTRAINT change_event_check_7 CHECK (jsonb_typeof(after) = 'object'),
  CONSTRAINT change_event_check_8 CHECK (num_nonnulls(summary_de, summary_it, summary_fr, summary_en) > 0),
  CONSTRAINT change_event_check_9 CHECK (occurred_at IS NULL OR (occurred_at AT TIME ZONE 'UTC')::date = occurred_on)
);
COMMENT ON COLUMN catalog.change_event.id IS 'Internal ID. Immutable internal identity, separate from the public catalog identifier and source identifiers.';
COMMENT ON COLUMN catalog.change_event.identifier IS 'ID. Unique event identifier; never an array position.';
COMMENT ON COLUMN catalog.change_event.occurred_on IS 'Date. Known event date. For events with occurredAt, use its UTC calendar date; preserve standalone legacy dates without inventing a timestamp.';
COMMENT ON COLUMN catalog.change_event.occurred_at IS 'Event timestamp. Exact event time when known; normalize to UTC. Its UTC calendar date must equal occurredOn. Keep legacy date-only events without this attribute.';
COMMENT ON COLUMN catalog.change_event.action IS 'Change. created, updated, imported, retired, restored. Preserve unmapped original action wording in summaries.';
COMMENT ON COLUMN catalog.change_event.actor_id IS 'Actor. Identified editor when available; this is edit attribution, not approval.';
COMMENT ON COLUMN catalog.change_event.actor_name_de IS 'Edited by (DE). German. Recorded name at the time of the edit, also when actorId resolves. Preserve known wording without translation or inferred identity; later Actor edits must not rewrite attribution.';
COMMENT ON COLUMN catalog.change_event.actor_name_it IS 'Edited by (IT). Italian. Recorded name at the time of the edit, also when actorId resolves. Preserve known wording without translation or inferred identity; later Actor edits must not rewrite attribution.';
COMMENT ON COLUMN catalog.change_event.actor_name_fr IS 'Edited by (FR). French. Recorded name at the time of the edit, also when actorId resolves. Preserve known wording without translation or inferred identity; later Actor edits must not rewrite attribution.';
COMMENT ON COLUMN catalog.change_event.actor_name_en IS 'Edited by (EN). English. Recorded name at the time of the edit, also when actorId resolves. Preserve known wording without translation or inferred identity; later Actor edits must not rewrite attribution.';
COMMENT ON COLUMN catalog.change_event.summary_de IS 'Details (DE). German. Change summary. At least one of the four summaries is required.';
COMMENT ON COLUMN catalog.change_event.summary_it IS 'Details (IT). Italian. Change summary. At least one of the four summaries is required.';
COMMENT ON COLUMN catalog.change_event.summary_fr IS 'Details (FR). French. Change summary. At least one of the four summaries is required.';
COMMENT ON COLUMN catalog.change_event.summary_en IS 'Details (EN). English. Change summary. At least one of the four summaries is required.';
COMMENT ON COLUMN catalog.change_event.changed_properties IS 'Changed properties. Canonical property paths, including the exact language suffix for translated text, where known.';
COMMENT ON COLUMN catalog.change_event.before IS 'Before change. Snapshot before the edit; required for new edits to existing records, absent for creation. Legacy events may lack it. Includes direct attributes, typed references, owned values, reference collections, owned endpoints and rowVersion; no linked-record expansion or derived counts.';
COMMENT ON COLUMN catalog.change_event.after IS 'After change. Snapshot after the edit, required for all new events; retirement retains the record and snapshot. Legacy history may omit it; never reconstruct unknown past values.';
COMMENT ON COLUMN catalog.change_event.import_id IS 'Import or operation ID. Shared operation identifier grouping related events from an import, batch or multi-record command. Required for new commands emitting multiple events, including relationship/product edits. One generated value is reused across retries; no separate operation entity is required.';

-- ServiceEndpoint
CREATE TABLE catalog.service_endpoint (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_service_id uuid NOT NULL REFERENCES catalog.data_service(id) ON DELETE RESTRICT,
  identifier catalog_private.identifier NOT NULL,
  url catalog_private.http_url,
  relative_path catalog_private.nonempty_text,
  protocol catalog_private.nonempty_text,
  http_method text COLLATE "C",
  operation_name catalog_private.nonempty_text,
  environment text COLLATE "C",
  is_read_only boolean,
  supports_bulk boolean,
  authentication_methods text[] COLLATE "C" NOT NULL DEFAULT '{}'::text[],
  verification_status text COLLATE "C" NOT NULL DEFAULT 'notChecked',
  UNIQUE (data_service_id, identifier),
  UNIQUE (data_service_id, id),
  CONSTRAINT service_endpoint_check_1 CHECK (http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS')),
  CONSTRAINT service_endpoint_check_2 CHECK (environment IN ('production', 'test', 'development')),
  CONSTRAINT service_endpoint_check_3 CHECK (catalog_private.valid_text_array(authentication_methods, false)),
  CONSTRAINT service_endpoint_check_4 CHECK (verification_status IN ('notChecked', 'metadataChecked', 'sampleChecked', 'accessDenied', 'failed', 'notChecked')),
  CONSTRAINT service_endpoint_check_5 CHECK (num_nonnulls(url, relative_path, operation_name) > 0)
);
COMMENT ON COLUMN catalog.service_endpoint.identifier IS 'ID. Stable and unique within the DataService. Unique with the owning DataService; internal persistence keys are described below.';
COMMENT ON COLUMN catalog.service_endpoint.url IS 'URL. Documented base or operation URL; unknown hosts are not invented.';
COMMENT ON COLUMN catalog.service_endpoint.relative_path IS 'Relative path. Documented path where the base is unavailable or separately specified.';
COMMENT ON COLUMN catalog.service_endpoint.protocol IS 'Protocol. Official protocol name/version, such as SOAP, REST, WMS, WFS.';
COMMENT ON COLUMN catalog.service_endpoint.http_method IS 'HTTP method. GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS.';
COMMENT ON COLUMN catalog.service_endpoint.operation_name IS 'Operation name. Exact operation identifier, never translated.';
COMMENT ON COLUMN catalog.service_endpoint.environment IS 'Environment. production, test, development, only when documented.';
COMMENT ON COLUMN catalog.service_endpoint.is_read_only IS 'Read-only. Documented behaviour, not inferred from the operation label.';
COMMENT ON COLUMN catalog.service_endpoint.supports_bulk IS 'Bulk access supported. Explicit bulk capability; not inferred from pagination or a sample response.';
COMMENT ON COLUMN catalog.service_endpoint.authentication_methods IS 'Authentication methods. Documented mechanism names. No passwords, tokens or private credentials.';
COMMENT ON COLUMN catalog.service_endpoint.verification_status IS 'Verification status. notChecked, metadataChecked, sampleChecked, accessDenied, failed. Every state beyond notChecked requires an operation-scoped result in the owning service''s ChangeEvent summary.';

-- Native references, including owner-scoped parents and endpoints.
ALTER TABLE catalog.domain ADD FOREIGN KEY (data_owner_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.domain ADD FOREIGN KEY (data_steward_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.domain ADD FOREIGN KEY (contact_actor_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.domain ADD FOREIGN KEY (parent_domain_id) REFERENCES catalog.domain(id) ON DELETE RESTRICT;
ALTER TABLE catalog.system ADD FOREIGN KEY (data_owner_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.system ADD FOREIGN KEY (data_steward_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.system ADD FOREIGN KEY (data_custodian_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.system ADD FOREIGN KEY (contact_actor_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.business_object ADD FOREIGN KEY (data_owner_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.business_object ADD FOREIGN KEY (data_steward_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.business_object ADD FOREIGN KEY (contact_actor_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.business_object ADD FOREIGN KEY (domain_id) REFERENCES catalog.domain(id) ON DELETE RESTRICT;
ALTER TABLE catalog.code_list ADD FOREIGN KEY (domain_id) REFERENCES catalog.domain(id) ON DELETE RESTRICT;
ALTER TABLE catalog.code_list ADD FOREIGN KEY (business_object_id) REFERENCES catalog.business_object(id) ON DELETE RESTRICT;
ALTER TABLE catalog.code_value ADD FOREIGN KEY (code_list_id) REFERENCES catalog.code_list(id) ON DELETE RESTRICT;
ALTER TABLE catalog.code_value ADD FOREIGN KEY (parent_code_value_id) REFERENCES catalog.code_value(id) ON DELETE RESTRICT;
ALTER TABLE catalog.code_value ADD FOREIGN KEY (code_list_id, parent_code_value_id) REFERENCES catalog.code_value(code_list_id, id) MATCH SIMPLE ON DELETE RESTRICT;
ALTER TABLE catalog.quality_requirement ADD FOREIGN KEY (contact_actor_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.business_attribute ADD FOREIGN KEY (data_owner_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.business_attribute ADD FOREIGN KEY (data_steward_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.business_attribute ADD FOREIGN KEY (contact_actor_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.business_attribute ADD FOREIGN KEY (business_object_id) REFERENCES catalog.business_object(id) ON DELETE RESTRICT;
ALTER TABLE catalog.business_attribute ADD FOREIGN KEY (code_list_id) REFERENCES catalog.code_list(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_table ADD FOREIGN KEY (data_owner_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_table ADD FOREIGN KEY (data_steward_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_table ADD FOREIGN KEY (data_custodian_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_table ADD FOREIGN KEY (contact_actor_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_table ADD FOREIGN KEY (system_id) REFERENCES catalog.system(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_table ADD FOREIGN KEY (domain_id) REFERENCES catalog.domain(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_field ADD FOREIGN KEY (data_owner_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_field ADD FOREIGN KEY (data_steward_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_field ADD FOREIGN KEY (data_custodian_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_field ADD FOREIGN KEY (contact_actor_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_field ADD FOREIGN KEY (data_table_id) REFERENCES catalog.data_table(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_field ADD FOREIGN KEY (code_list_id) REFERENCES catalog.code_list(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_product ADD FOREIGN KEY (data_owner_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_product ADD FOREIGN KEY (data_steward_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_product ADD FOREIGN KEY (contact_actor_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_product ADD FOREIGN KEY (domain_id) REFERENCES catalog.domain(id) ON DELETE RESTRICT;
ALTER TABLE catalog.product_attribute ADD FOREIGN KEY (data_product_id) REFERENCES catalog.data_product(id) ON DELETE RESTRICT;
ALTER TABLE catalog.product_attribute ADD FOREIGN KEY (business_attribute_id) REFERENCES catalog.business_attribute(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_service ADD FOREIGN KEY (data_owner_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_service ADD FOREIGN KEY (data_steward_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_service ADD FOREIGN KEY (data_custodian_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_service ADD FOREIGN KEY (contact_actor_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_service ADD FOREIGN KEY (system_id) REFERENCES catalog.system(id) ON DELETE RESTRICT;
ALTER TABLE catalog.data_service ADD FOREIGN KEY (domain_id) REFERENCES catalog.domain(id) ON DELETE RESTRICT;
ALTER TABLE catalog.relationship ADD FOREIGN KEY (source_business_object_id) REFERENCES catalog.business_object(id) ON DELETE RESTRICT;
ALTER TABLE catalog.relationship ADD FOREIGN KEY (source_data_product_id) REFERENCES catalog.data_product(id) ON DELETE RESTRICT;
ALTER TABLE catalog.relationship ADD FOREIGN KEY (source_data_table_id) REFERENCES catalog.data_table(id) ON DELETE RESTRICT;
ALTER TABLE catalog.relationship ADD FOREIGN KEY (source_data_field_id) REFERENCES catalog.data_field(id) ON DELETE RESTRICT;
ALTER TABLE catalog.relationship ADD FOREIGN KEY (source_data_service_id) REFERENCES catalog.data_service(id) ON DELETE RESTRICT;
ALTER TABLE catalog.relationship ADD FOREIGN KEY (target_business_object_id) REFERENCES catalog.business_object(id) ON DELETE RESTRICT;
ALTER TABLE catalog.relationship ADD FOREIGN KEY (target_business_attribute_id) REFERENCES catalog.business_attribute(id) ON DELETE RESTRICT;
ALTER TABLE catalog.relationship ADD FOREIGN KEY (target_data_table_id) REFERENCES catalog.data_table(id) ON DELETE RESTRICT;
ALTER TABLE catalog.relationship ADD FOREIGN KEY (target_data_field_id) REFERENCES catalog.data_field(id) ON DELETE RESTRICT;
ALTER TABLE catalog.relationship ADD FOREIGN KEY (target_data_service_id) REFERENCES catalog.data_service(id) ON DELETE RESTRICT;
ALTER TABLE catalog.lineage_relation ADD FOREIGN KEY (source_data_table_id) REFERENCES catalog.data_table(id) ON DELETE RESTRICT;
ALTER TABLE catalog.lineage_relation ADD FOREIGN KEY (source_data_field_id) REFERENCES catalog.data_field(id) ON DELETE RESTRICT;
ALTER TABLE catalog.lineage_relation ADD FOREIGN KEY (target_data_table_id) REFERENCES catalog.data_table(id) ON DELETE RESTRICT;
ALTER TABLE catalog.lineage_relation ADD FOREIGN KEY (target_data_field_id) REFERENCES catalog.data_field(id) ON DELETE RESTRICT;
ALTER TABLE catalog.change_event ADD FOREIGN KEY (record_actor_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.change_event ADD FOREIGN KEY (record_domain_id) REFERENCES catalog.domain(id) ON DELETE RESTRICT;
ALTER TABLE catalog.change_event ADD FOREIGN KEY (record_system_id) REFERENCES catalog.system(id) ON DELETE RESTRICT;
ALTER TABLE catalog.change_event ADD FOREIGN KEY (record_business_object_id) REFERENCES catalog.business_object(id) ON DELETE RESTRICT;
ALTER TABLE catalog.change_event ADD FOREIGN KEY (record_code_list_id) REFERENCES catalog.code_list(id) ON DELETE RESTRICT;
ALTER TABLE catalog.change_event ADD FOREIGN KEY (record_code_value_id) REFERENCES catalog.code_value(id) ON DELETE RESTRICT;
ALTER TABLE catalog.change_event ADD FOREIGN KEY (record_quality_requirement_id) REFERENCES catalog.quality_requirement(id) ON DELETE RESTRICT;
ALTER TABLE catalog.change_event ADD FOREIGN KEY (record_business_attribute_id) REFERENCES catalog.business_attribute(id) ON DELETE RESTRICT;
ALTER TABLE catalog.change_event ADD FOREIGN KEY (record_data_table_id) REFERENCES catalog.data_table(id) ON DELETE RESTRICT;
ALTER TABLE catalog.change_event ADD FOREIGN KEY (record_data_field_id) REFERENCES catalog.data_field(id) ON DELETE RESTRICT;
ALTER TABLE catalog.change_event ADD FOREIGN KEY (record_data_product_id) REFERENCES catalog.data_product(id) ON DELETE RESTRICT;
ALTER TABLE catalog.change_event ADD FOREIGN KEY (record_product_attribute_id) REFERENCES catalog.product_attribute(id) ON DELETE RESTRICT;
ALTER TABLE catalog.change_event ADD FOREIGN KEY (record_data_service_id) REFERENCES catalog.data_service(id) ON DELETE RESTRICT;
ALTER TABLE catalog.change_event ADD FOREIGN KEY (record_relationship_id) REFERENCES catalog.relationship(id) ON DELETE RESTRICT;
ALTER TABLE catalog.change_event ADD FOREIGN KEY (record_lineage_relation_id) REFERENCES catalog.lineage_relation(id) ON DELETE RESTRICT;
ALTER TABLE catalog.change_event ADD FOREIGN KEY (actor_id) REFERENCES catalog.actor(id) ON DELETE RESTRICT;
ALTER TABLE catalog.relationship ADD FOREIGN KEY (source_data_service_id, source_endpoint_id) REFERENCES catalog.service_endpoint(data_service_id, id) MATCH SIMPLE ON DELETE RESTRICT;

CREATE INDEX domain_data_owner_id_idx ON catalog.domain (data_owner_id) WHERE data_owner_id IS NOT NULL;
CREATE INDEX domain_data_steward_id_idx ON catalog.domain (data_steward_id) WHERE data_steward_id IS NOT NULL;
CREATE INDEX domain_contact_actor_id_idx ON catalog.domain (contact_actor_id) WHERE contact_actor_id IS NOT NULL;
CREATE INDEX domain_parent_domain_id_idx ON catalog.domain (parent_domain_id) WHERE parent_domain_id IS NOT NULL;
CREATE INDEX system_data_owner_id_idx ON catalog.system (data_owner_id) WHERE data_owner_id IS NOT NULL;
CREATE INDEX system_data_steward_id_idx ON catalog.system (data_steward_id) WHERE data_steward_id IS NOT NULL;
CREATE INDEX system_data_custodian_id_idx ON catalog.system (data_custodian_id) WHERE data_custodian_id IS NOT NULL;
CREATE INDEX system_contact_actor_id_idx ON catalog.system (contact_actor_id) WHERE contact_actor_id IS NOT NULL;
CREATE INDEX business_object_data_owner_id_idx ON catalog.business_object (data_owner_id) WHERE data_owner_id IS NOT NULL;
CREATE INDEX business_object_data_steward_id_idx ON catalog.business_object (data_steward_id) WHERE data_steward_id IS NOT NULL;
CREATE INDEX business_object_contact_actor_id_idx ON catalog.business_object (contact_actor_id) WHERE contact_actor_id IS NOT NULL;
CREATE INDEX business_object_domain_id_idx ON catalog.business_object (domain_id) WHERE domain_id IS NOT NULL;
CREATE INDEX code_list_domain_id_idx ON catalog.code_list (domain_id) WHERE domain_id IS NOT NULL;
CREATE INDEX code_list_business_object_id_idx ON catalog.code_list (business_object_id) WHERE business_object_id IS NOT NULL;
CREATE INDEX code_value_code_list_id_idx ON catalog.code_value (code_list_id) WHERE code_list_id IS NOT NULL;
CREATE INDEX code_value_parent_code_value_id_idx ON catalog.code_value (parent_code_value_id) WHERE parent_code_value_id IS NOT NULL;
CREATE INDEX quality_requirement_contact_actor_id_idx ON catalog.quality_requirement (contact_actor_id) WHERE contact_actor_id IS NOT NULL;
CREATE INDEX business_attribute_data_owner_id_idx ON catalog.business_attribute (data_owner_id) WHERE data_owner_id IS NOT NULL;
CREATE INDEX business_attribute_data_steward_id_idx ON catalog.business_attribute (data_steward_id) WHERE data_steward_id IS NOT NULL;
CREATE INDEX business_attribute_contact_actor_id_idx ON catalog.business_attribute (contact_actor_id) WHERE contact_actor_id IS NOT NULL;
CREATE INDEX business_attribute_business_object_id_idx ON catalog.business_attribute (business_object_id) WHERE business_object_id IS NOT NULL;
CREATE INDEX business_attribute_code_list_id_idx ON catalog.business_attribute (code_list_id) WHERE code_list_id IS NOT NULL;
CREATE INDEX data_table_data_owner_id_idx ON catalog.data_table (data_owner_id) WHERE data_owner_id IS NOT NULL;
CREATE INDEX data_table_data_steward_id_idx ON catalog.data_table (data_steward_id) WHERE data_steward_id IS NOT NULL;
CREATE INDEX data_table_data_custodian_id_idx ON catalog.data_table (data_custodian_id) WHERE data_custodian_id IS NOT NULL;
CREATE INDEX data_table_contact_actor_id_idx ON catalog.data_table (contact_actor_id) WHERE contact_actor_id IS NOT NULL;
CREATE INDEX data_table_system_id_idx ON catalog.data_table (system_id) WHERE system_id IS NOT NULL;
CREATE INDEX data_table_domain_id_idx ON catalog.data_table (domain_id) WHERE domain_id IS NOT NULL;
CREATE INDEX data_field_data_owner_id_idx ON catalog.data_field (data_owner_id) WHERE data_owner_id IS NOT NULL;
CREATE INDEX data_field_data_steward_id_idx ON catalog.data_field (data_steward_id) WHERE data_steward_id IS NOT NULL;
CREATE INDEX data_field_data_custodian_id_idx ON catalog.data_field (data_custodian_id) WHERE data_custodian_id IS NOT NULL;
CREATE INDEX data_field_contact_actor_id_idx ON catalog.data_field (contact_actor_id) WHERE contact_actor_id IS NOT NULL;
CREATE INDEX data_field_data_table_id_idx ON catalog.data_field (data_table_id) WHERE data_table_id IS NOT NULL;
CREATE INDEX data_field_code_list_id_idx ON catalog.data_field (code_list_id) WHERE code_list_id IS NOT NULL;
CREATE INDEX data_product_data_owner_id_idx ON catalog.data_product (data_owner_id) WHERE data_owner_id IS NOT NULL;
CREATE INDEX data_product_data_steward_id_idx ON catalog.data_product (data_steward_id) WHERE data_steward_id IS NOT NULL;
CREATE INDEX data_product_contact_actor_id_idx ON catalog.data_product (contact_actor_id) WHERE contact_actor_id IS NOT NULL;
CREATE INDEX data_product_domain_id_idx ON catalog.data_product (domain_id) WHERE domain_id IS NOT NULL;
CREATE INDEX product_attribute_data_product_id_idx ON catalog.product_attribute (data_product_id) WHERE data_product_id IS NOT NULL;
CREATE INDEX product_attribute_business_attribute_id_idx ON catalog.product_attribute (business_attribute_id) WHERE business_attribute_id IS NOT NULL;
CREATE INDEX data_service_data_owner_id_idx ON catalog.data_service (data_owner_id) WHERE data_owner_id IS NOT NULL;
CREATE INDEX data_service_data_steward_id_idx ON catalog.data_service (data_steward_id) WHERE data_steward_id IS NOT NULL;
CREATE INDEX data_service_data_custodian_id_idx ON catalog.data_service (data_custodian_id) WHERE data_custodian_id IS NOT NULL;
CREATE INDEX data_service_contact_actor_id_idx ON catalog.data_service (contact_actor_id) WHERE contact_actor_id IS NOT NULL;
CREATE INDEX data_service_system_id_idx ON catalog.data_service (system_id) WHERE system_id IS NOT NULL;
CREATE INDEX data_service_domain_id_idx ON catalog.data_service (domain_id) WHERE domain_id IS NOT NULL;
CREATE INDEX relationship_source_business_object_id_idx ON catalog.relationship (source_business_object_id) WHERE source_business_object_id IS NOT NULL;
CREATE INDEX relationship_source_data_product_id_idx ON catalog.relationship (source_data_product_id) WHERE source_data_product_id IS NOT NULL;
CREATE INDEX relationship_source_data_table_id_idx ON catalog.relationship (source_data_table_id) WHERE source_data_table_id IS NOT NULL;
CREATE INDEX relationship_source_data_field_id_idx ON catalog.relationship (source_data_field_id) WHERE source_data_field_id IS NOT NULL;
CREATE INDEX relationship_source_data_service_id_idx ON catalog.relationship (source_data_service_id) WHERE source_data_service_id IS NOT NULL;
CREATE INDEX relationship_target_business_object_id_idx ON catalog.relationship (target_business_object_id) WHERE target_business_object_id IS NOT NULL;
CREATE INDEX relationship_target_business_attribute_id_idx ON catalog.relationship (target_business_attribute_id) WHERE target_business_attribute_id IS NOT NULL;
CREATE INDEX relationship_target_data_table_id_idx ON catalog.relationship (target_data_table_id) WHERE target_data_table_id IS NOT NULL;
CREATE INDEX relationship_target_data_field_id_idx ON catalog.relationship (target_data_field_id) WHERE target_data_field_id IS NOT NULL;
CREATE INDEX relationship_target_data_service_id_idx ON catalog.relationship (target_data_service_id) WHERE target_data_service_id IS NOT NULL;
CREATE INDEX lineage_relation_source_data_table_id_idx ON catalog.lineage_relation (source_data_table_id) WHERE source_data_table_id IS NOT NULL;
CREATE INDEX lineage_relation_source_data_field_id_idx ON catalog.lineage_relation (source_data_field_id) WHERE source_data_field_id IS NOT NULL;
CREATE INDEX lineage_relation_target_data_table_id_idx ON catalog.lineage_relation (target_data_table_id) WHERE target_data_table_id IS NOT NULL;
CREATE INDEX lineage_relation_target_data_field_id_idx ON catalog.lineage_relation (target_data_field_id) WHERE target_data_field_id IS NOT NULL;
CREATE INDEX change_event_record_actor_id_idx ON catalog.change_event (record_actor_id) WHERE record_actor_id IS NOT NULL;
CREATE INDEX change_event_record_domain_id_idx ON catalog.change_event (record_domain_id) WHERE record_domain_id IS NOT NULL;
CREATE INDEX change_event_record_system_id_idx ON catalog.change_event (record_system_id) WHERE record_system_id IS NOT NULL;
CREATE INDEX change_event_record_business_object_id_idx ON catalog.change_event (record_business_object_id) WHERE record_business_object_id IS NOT NULL;
CREATE INDEX change_event_record_code_list_id_idx ON catalog.change_event (record_code_list_id) WHERE record_code_list_id IS NOT NULL;
CREATE INDEX change_event_record_code_value_id_idx ON catalog.change_event (record_code_value_id) WHERE record_code_value_id IS NOT NULL;
CREATE INDEX change_event_record_quality_requirement_id_idx ON catalog.change_event (record_quality_requirement_id) WHERE record_quality_requirement_id IS NOT NULL;
CREATE INDEX change_event_record_business_attribute_id_idx ON catalog.change_event (record_business_attribute_id) WHERE record_business_attribute_id IS NOT NULL;
CREATE INDEX change_event_record_data_table_id_idx ON catalog.change_event (record_data_table_id) WHERE record_data_table_id IS NOT NULL;
CREATE INDEX change_event_record_data_field_id_idx ON catalog.change_event (record_data_field_id) WHERE record_data_field_id IS NOT NULL;
CREATE INDEX change_event_record_data_product_id_idx ON catalog.change_event (record_data_product_id) WHERE record_data_product_id IS NOT NULL;
CREATE INDEX change_event_record_product_attribute_id_idx ON catalog.change_event (record_product_attribute_id) WHERE record_product_attribute_id IS NOT NULL;
CREATE INDEX change_event_record_data_service_id_idx ON catalog.change_event (record_data_service_id) WHERE record_data_service_id IS NOT NULL;
CREATE INDEX change_event_record_relationship_id_idx ON catalog.change_event (record_relationship_id) WHERE record_relationship_id IS NOT NULL;
CREATE INDEX change_event_record_lineage_relation_id_idx ON catalog.change_event (record_lineage_relation_id) WHERE record_lineage_relation_id IS NOT NULL;
CREATE INDEX change_event_actor_id_idx ON catalog.change_event (actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX service_endpoint_data_service_id_idx ON catalog.service_endpoint (data_service_id) WHERE data_service_id IS NOT NULL;
CREATE UNIQUE INDEX relationship_realizes_uq ON catalog.relationship (source_data_table_id, target_business_object_id) WHERE relationship_type = 'realizes';
CREATE UNIQUE INDEX relationship_represents_uq ON catalog.relationship (source_data_field_id, target_business_attribute_id) WHERE relationship_type = 'represents';
CREATE UNIQUE INDEX relationship_correspondsto_uq ON catalog.relationship (source_data_field_id, target_data_field_id) WHERE relationship_type = 'correspondsTo';
CREATE UNIQUE INDEX relationship_exposes_endpoint_uq ON catalog.relationship (source_data_service_id, target_data_table_id, source_endpoint_id) WHERE relationship_type = 'exposes' AND source_endpoint_id IS NOT NULL AND target_data_table_id IS NOT NULL;
CREATE UNIQUE INDEX relationship_exposes_service_uq ON catalog.relationship (source_data_service_id, target_data_table_id) WHERE relationship_type = 'exposes' AND source_endpoint_id IS NULL AND target_data_table_id IS NOT NULL;
CREATE UNIQUE INDEX relationship_exposes_field_endpoint_uq ON catalog.relationship (source_data_service_id, target_data_field_id, source_endpoint_id) WHERE relationship_type = 'exposes' AND source_endpoint_id IS NOT NULL AND target_data_field_id IS NOT NULL;
CREATE UNIQUE INDEX relationship_exposes_field_service_uq ON catalog.relationship (source_data_service_id, target_data_field_id) WHERE relationship_type = 'exposes' AND source_endpoint_id IS NULL AND target_data_field_id IS NOT NULL;
CREATE UNIQUE INDEX relationship_assesses_endpoint_uq ON catalog.relationship (source_data_service_id, target_business_attribute_id, source_endpoint_id) WHERE relationship_type = 'assesses' AND source_endpoint_id IS NOT NULL AND target_business_attribute_id IS NOT NULL;
CREATE UNIQUE INDEX relationship_basedon_uq ON catalog.relationship (source_data_product_id, target_business_object_id) WHERE relationship_type = 'basedOn';
CREATE UNIQUE INDEX relationship_sourcedfrom_uq ON catalog.relationship (source_data_product_id, target_data_table_id) WHERE relationship_type = 'sourcedFrom';
CREATE UNIQUE INDEX relationship_servedby_uq ON catalog.relationship (source_data_product_id, target_data_service_id) WHERE relationship_type = 'servedBy';
CREATE UNIQUE INDEX relationship_measuredfor_uq ON catalog.relationship (source_business_object_id, target_business_object_id) WHERE relationship_type = 'measuredFor';
CREATE UNIQUE INDEX lineage_relation_data_table_uq ON catalog.lineage_relation (source_data_table_id, target_data_table_id) WHERE source_data_table_id IS NOT NULL;
CREATE UNIQUE INDEX lineage_relation_data_field_uq ON catalog.lineage_relation (source_data_field_id, target_data_field_id) WHERE source_data_field_id IS NOT NULL;
CREATE TABLE catalog.business_attribute_quality_requirement (
  business_attribute_id uuid NOT NULL REFERENCES catalog.business_attribute(id) ON DELETE RESTRICT,
  quality_requirement_id uuid NOT NULL REFERENCES catalog.quality_requirement(id) ON DELETE RESTRICT,
  PRIMARY KEY (business_attribute_id, quality_requirement_id)
);
CREATE INDEX business_attribute_quality_requirement_rule_idx ON catalog.business_attribute_quality_requirement (quality_requirement_id);

CREATE TABLE catalog.data_field_quality_requirement (
  data_field_id uuid NOT NULL REFERENCES catalog.data_field(id) ON DELETE RESTRICT,
  quality_requirement_id uuid NOT NULL REFERENCES catalog.quality_requirement(id) ON DELETE RESTRICT,
  PRIMARY KEY (data_field_id, quality_requirement_id)
);
CREATE INDEX data_field_quality_requirement_rule_idx ON catalog.data_field_quality_requirement (quality_requirement_id);

-- Serialize metadata writes before cross-record validation. Keep batches short.
-- READ COMMITTED refreshes trigger queries after waiting; SERIALIZABLE callers retry 40001.
CREATE FUNCTION catalog_private.serialize_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF current_setting('transaction_isolation') = 'repeatable read' THEN
    RAISE EXCEPTION 'Catalog writes require READ COMMITTED or SERIALIZABLE' USING ERRCODE = '25000';
  END IF;
  PERFORM pg_advisory_xact_lock(18427, 1);
  RETURN NULL;
END;
$$;

CREATE FUNCTION catalog_private.guard_record()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE previous jsonb; proposed jsonb; immutable text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Retain catalog identities; retire or obsolete the record instead' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF to_jsonb(NEW)->>'version' IS NOT NULL AND to_jsonb(NEW)->>'version_date' IS NULL
      AND current_setting('catalog.import_legacy', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'A new version requires its issue date; legacy imports must opt in explicitly' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  previous := to_jsonb(OLD); proposed := to_jsonb(NEW);
  FOREACH immutable IN ARRAY ARRAY['id','identifier','business_object_id','data_table_id','code_list_id','data_product_id'] LOOP
    -- code_list_id is frozen only for CodeValue, not for a field/attribute vocabulary edit.
    IF immutable = 'code_list_id' AND TG_TABLE_NAME <> 'code_value' THEN CONTINUE; END IF;
    IF immutable = 'business_object_id' AND TG_TABLE_NAME <> 'business_attribute' THEN CONTINUE; END IF;
    IF previous ? immutable AND previous->immutable IS DISTINCT FROM proposed->immutable THEN
      RAISE EXCEPTION 'Immutable identity/owner: %.%', TG_TABLE_NAME, immutable USING ERRCODE = '23514';
    END IF;
  END LOOP;
  IF TG_TABLE_NAME IN ('relationship','lineage_relation') THEN
    FOR immutable IN SELECT key FROM jsonb_object_keys(previous) key
      WHERE key LIKE 'source\_%' ESCAPE '\' OR key LIKE 'target\_%' ESCAPE '\' OR key = 'relationship_type' LOOP
      IF previous->immutable IS DISTINCT FROM proposed->immutable THEN
        RAISE EXCEPTION 'Assertion scope is immutable' USING ERRCODE = '23514';
      END IF;
    END LOOP;
    IF previous->>'verification_status' IN ('rejected','obsolete')
      AND proposed->>'verification_status' NOT IN ('rejected','obsolete','candidate') THEN
      RAISE EXCEPTION 'Restore an inactive assertion to candidate first' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF proposed ? 'version' THEN
    IF proposed->>'version' IS NOT NULL AND previous->>'version' IS DISTINCT FROM proposed->>'version'
      AND proposed->>'version_date' IS NULL THEN
      RAISE EXCEPTION 'A changed version requires its issue date' USING ERRCODE = '23514';
    END IF;
    IF previous->>'version_date' IS NOT NULL AND proposed->>'version' IS NOT NULL AND proposed->>'version_date' IS NULL THEN
      RAISE EXCEPTION 'Keep the known version date or clear both version and date' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF (previous - 'row_version') = (proposed - 'row_version') THEN RETURN NULL; END IF;
  NEW.row_version := OLD.row_version + 1;
  RETURN NEW;
END;
$$;

CREATE FUNCTION catalog_private.guard_history()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'ChangeEvent is append-only' USING ERRCODE = '23514';
END;
$$;

CREATE FUNCTION catalog_private.guard_hierarchy()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE parent_column text := TG_ARGV[0]; parent_id uuid := (to_jsonb(NEW)->>TG_ARGV[0])::uuid; cyclic boolean;
BEGIN
  IF parent_id IS NULL THEN RETURN NEW; END IF;
  EXECUTE format('WITH RECURSIVE ancestors AS (
    SELECT id, %1$I AS parent_id FROM catalog.%2$I WHERE id = $1
    UNION SELECT p.id, p.%1$I FROM catalog.%2$I p JOIN ancestors a ON p.id = a.parent_id
  ) SELECT EXISTS (SELECT FROM ancestors WHERE id = $2)', parent_column, TG_TABLE_NAME)
    INTO cyclic USING parent_id, NEW.id;
  IF cyclic THEN RAISE EXCEPTION 'Hierarchy cycle' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION catalog_private.guard_quality_assignment()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE rule catalog.quality_requirement; business_type text;
BEGIN
  SELECT * INTO rule FROM catalog.quality_requirement WHERE id = NEW.quality_requirement_id;
  IF NOT FOUND THEN RETURN NEW; END IF; -- Let the native FK report a missing rule.
  IF rule.status = 'retired' THEN RAISE EXCEPTION 'Cannot assign a retired rule' USING ERRCODE = '23514'; END IF;
  IF TG_TABLE_NAME = 'business_attribute_quality_requirement' THEN
    SELECT value_specification->>'valueType' INTO business_type FROM catalog.business_attribute WHERE id = NEW.business_attribute_id;
    IF rule.rule_type = 'greaterThan' AND business_type NOT IN ('integer','decimal','year') THEN
      RAISE EXCEPTION 'Numeric rule is incompatible with the business value type' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION catalog_private.guard_quality_edit()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF TG_TABLE_NAME = 'quality_requirement' THEN
    IF NEW.rule_type = 'greaterThan' AND EXISTS (
      SELECT FROM catalog.business_attribute_quality_requirement a
      JOIN catalog.business_attribute b ON b.id = a.business_attribute_id
      WHERE a.quality_requirement_id = NEW.id AND b.value_specification->>'valueType' NOT IN ('integer','decimal','year')
    ) THEN RAISE EXCEPTION 'Rule conflicts with an assigned business type' USING ERRCODE = '23514'; END IF;
  ELSE
    IF NEW.value_specification->>'valueType' NOT IN ('integer','decimal','year') AND EXISTS (
      SELECT FROM catalog.business_attribute_quality_requirement a
      JOIN catalog.quality_requirement q ON q.id = a.quality_requirement_id
      WHERE a.business_attribute_id = NEW.id AND q.rule_type = 'greaterThan'
    ) THEN RAISE EXCEPTION 'Business type conflicts with an assigned numeric rule' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION catalog_private.guard_endpoint()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.identifier <> OLD.identifier OR NEW.data_service_id <> OLD.data_service_id THEN
    RAISE EXCEPTION 'Endpoint identity and owner are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION catalog_private.guard_assertion()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE item record; kind text; target_status text; proposed jsonb := to_jsonb(NEW);
  validate_scope boolean; validate_version boolean; release text;
BEGIN
  validate_scope := TG_OP = 'INSERT';
  IF TG_OP = 'UPDATE' THEN
    validate_scope := (OLD.verification_status IN ('rejected','obsolete') AND NEW.verification_status = 'candidate')
      OR (OLD.verification_status <> 'confirmed' AND NEW.verification_status = 'confirmed');
  END IF;
  IF validate_scope THEN
    FOR item IN SELECT * FROM jsonb_each_text(proposed) LOOP
      kind := substring(item.key FROM '^(?:source|target)_(business_object|business_attribute|data_product|data_service|data_table|data_field)_id$');
      IF kind IS NOT NULL AND item.value IS NOT NULL THEN
        EXECUTE format('SELECT status FROM catalog.%I WHERE id = $1', kind) INTO target_status USING item.value::uuid;
        IF target_status = 'retired' THEN RAISE EXCEPTION 'Cannot create, restore or confirm links to retired records' USING ERRCODE = '23514'; END IF;
      END IF;
    END LOOP;
  END IF;
  IF TG_TABLE_NAME = 'relationship' AND NEW.verification_status = 'confirmed'
    AND proposed->>'relationship_type' IN ('exposes','assesses') THEN
    validate_version := TG_OP = 'INSERT';
    IF TG_OP = 'UPDATE' THEN
      validate_version := validate_scope OR (to_jsonb(OLD)->>'assessed_service_version' IS DISTINCT FROM proposed->>'assessed_service_version');
    END IF;
    IF validate_version THEN
      SELECT service_version INTO release FROM catalog.data_service WHERE id = (proposed->>'source_data_service_id')::uuid;
      IF release IS NOT NULL AND proposed->>'assessed_service_version' IS DISTINCT FROM release THEN
        RAISE EXCEPTION 'Confirmation must identify the documented current service release' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.actor FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER b_guard_record BEFORE INSERT OR UPDATE OR DELETE ON catalog.actor FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_record();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.domain FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER b_guard_record BEFORE INSERT OR UPDATE OR DELETE ON catalog.domain FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_record();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.system FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER b_guard_record BEFORE INSERT OR UPDATE OR DELETE ON catalog.system FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_record();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.business_object FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER b_guard_record BEFORE INSERT OR UPDATE OR DELETE ON catalog.business_object FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_record();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.code_list FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER b_guard_record BEFORE INSERT OR UPDATE OR DELETE ON catalog.code_list FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_record();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.code_value FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER b_guard_record BEFORE INSERT OR UPDATE OR DELETE ON catalog.code_value FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_record();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.quality_requirement FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER b_guard_record BEFORE INSERT OR UPDATE OR DELETE ON catalog.quality_requirement FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_record();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.business_attribute FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER b_guard_record BEFORE INSERT OR UPDATE OR DELETE ON catalog.business_attribute FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_record();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.data_table FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER b_guard_record BEFORE INSERT OR UPDATE OR DELETE ON catalog.data_table FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_record();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.data_field FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER b_guard_record BEFORE INSERT OR UPDATE OR DELETE ON catalog.data_field FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_record();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.data_product FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER b_guard_record BEFORE INSERT OR UPDATE OR DELETE ON catalog.data_product FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_record();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.product_attribute FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER b_guard_record BEFORE INSERT OR UPDATE OR DELETE ON catalog.product_attribute FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_record();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.data_service FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER b_guard_record BEFORE INSERT OR UPDATE OR DELETE ON catalog.data_service FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_record();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.relationship FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER b_guard_record BEFORE INSERT OR UPDATE OR DELETE ON catalog.relationship FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_record();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.lineage_relation FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER b_guard_record BEFORE INSERT OR UPDATE OR DELETE ON catalog.lineage_relation FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_record();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.change_event FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON catalog.change_event FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_history();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.service_endpoint FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.business_attribute_quality_requirement FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER a_serialize_write BEFORE INSERT OR UPDATE OR DELETE ON catalog.data_field_quality_requirement FOR EACH STATEMENT EXECUTE FUNCTION catalog_private.serialize_write();
CREATE TRIGGER c_guard_hierarchy BEFORE INSERT OR UPDATE ON catalog.domain FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_hierarchy('parent_domain_id');
CREATE TRIGGER c_guard_hierarchy BEFORE INSERT OR UPDATE ON catalog.code_value FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_hierarchy('parent_code_value_id');
CREATE TRIGGER c_guard_assignment BEFORE INSERT OR UPDATE ON catalog.business_attribute_quality_requirement FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_quality_assignment();
CREATE TRIGGER c_guard_assignment BEFORE INSERT OR UPDATE ON catalog.data_field_quality_requirement FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_quality_assignment();
CREATE TRIGGER c_guard_quality_edit BEFORE UPDATE ON catalog.business_attribute FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_quality_edit();
CREATE TRIGGER c_guard_quality_edit BEFORE UPDATE ON catalog.quality_requirement FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_quality_edit();
CREATE TRIGGER c_guard_endpoint BEFORE UPDATE ON catalog.service_endpoint FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_endpoint();
CREATE TRIGGER c_guard_assertion BEFORE INSERT OR UPDATE ON catalog.relationship FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_assertion();
CREATE TRIGGER c_guard_assertion BEFORE INSERT OR UPDATE ON catalog.lineage_relation FOR EACH ROW EXECUTE FUNCTION catalog_private.guard_assertion();

-- No public/authenticated policies are created. Catalog classification is descriptive,
-- not an authorization rule. Add explicit application access in a later migration.

ALTER TABLE catalog.actor ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.domain ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.system ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.business_object ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.code_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.code_value ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.quality_requirement ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.business_attribute ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.data_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.data_field ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.data_product ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.product_attribute ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.data_service ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.relationship ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.lineage_relation ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.change_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.service_endpoint ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.business_attribute_quality_requirement ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog.data_field_quality_requirement ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA catalog FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA catalog_private FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA catalog FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA catalog TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA catalog TO service_role;

COMMENT ON SCHEMA catalog IS 'Internal metadata catalog. No source-system data or credentials. Browser access is disabled.';
COMMENT ON SCHEMA catalog_private IS 'Private row validators and integrity guards; do not expose through the Data API.';

NOTIFY pgrst, 'reload schema';
COMMIT;
