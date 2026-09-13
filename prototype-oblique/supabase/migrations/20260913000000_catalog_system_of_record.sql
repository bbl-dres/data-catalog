-- Apply after 20260912010000_catalog_rest_crud.sql as postgres.
-- Designates an authoritative System explicitly; no legacy source text is backfilled.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '10s';

DO $$ BEGIN
  IF to_regprocedure('catalog.save_entry(uuid,text,uuid,bigint,jsonb,jsonb)') IS NULL
    OR to_regprocedure('catalog.api_write(text,text,uuid,bigint,jsonb,uuid)') IS NULL THEN
    RAISE EXCEPTION 'Apply catalog_editing and catalog_rest_crud before catalog_system_of_record'
      USING ERRCODE = '55000';
  END IF;
END $$;

ALTER TABLE catalog.business_object ADD COLUMN system_of_record_id uuid
  REFERENCES catalog.system(id) ON DELETE RESTRICT;
ALTER TABLE catalog.business_attribute ADD COLUMN system_of_record_id uuid
  REFERENCES catalog.system(id) ON DELETE RESTRICT;
CREATE INDEX business_object_system_of_record_id_idx ON catalog.business_object(system_of_record_id)
  WHERE system_of_record_id IS NOT NULL;
CREATE INDEX business_attribute_system_of_record_id_idx ON catalog.business_attribute(system_of_record_id)
  WHERE system_of_record_id IS NOT NULL;
COMMENT ON COLUMN catalog.business_object.system_of_record_id IS
  'System of record. Explicit authoritative System UUID for this business object; NULL means not designated. Separate from metadata provenance and technical storage. Existing references survive System archival.';
COMMENT ON COLUMN catalog.business_attribute.system_of_record_id IS
  'System of record. Explicit authoritative System UUID override; NULL inherits the owning BusinessObject designation. Clearing restores inheritance. Effective values are derived, never copied into this column.';

-- Extend the frozen browser and REST write inventories for these two fields only.
CREATE OR REPLACE FUNCTION catalog_private.edit_columns(tab text) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
SELECT CASE WHEN tab = 'service_endpoint' THEN ARRAY['url','relative_path','protocol','http_method','operation_name','environment','is_read_only','supports_bulk','authentication_methods','sort_order','is_archived']
 WHEN tab IN ('domain','system','business_object','business_attribute','data_table','data_field','code_list','code_value','data_product','product_attribute','data_service') THEN
 ARRAY['name_de','name_fr','name_it','name_en','description_de','description_fr','description_it','description_en','comment','documentation_links'] ||
 CASE WHEN tab NOT IN ('code_value','product_attribute') THEN ARRAY['status','version','version_date'] ELSE '{}'::text[] END ||
 CASE WHEN tab IN ('domain','system','business_object','business_attribute','data_table','data_field','data_product','data_service') THEN ARRAY['responsible_organisation','data_owner_id','data_steward_id','contact_actor_id'] ELSE '{}'::text[] END ||
 CASE WHEN tab IN ('system','data_table','data_field','data_service') THEN ARRAY['data_custodian_id'] ELSE '{}'::text[] END ||
 CASE WHEN tab IN ('system','business_object','business_attribute','data_table','data_field','data_product','data_service') THEN ARRAY['classification','contains_personal_data'] ELSE '{}'::text[] END ||
 CASE WHEN tab IN ('business_attribute','data_field','code_value','product_attribute') THEN ARRAY['sort_order','is_archived'] ELSE '{}'::text[] END ||
 CASE tab
  WHEN 'domain' THEN ARRAY['parent_domain_id']
  WHEN 'system' THEN ARRAY['system_type','technology']
  WHEN 'business_object' THEN ARRAY['domain_id','normative_references','system_of_record_id']
  WHEN 'business_attribute' THEN ARRAY['semantic_name','value_specification','is_identifier','code_list_id','required','system_of_record_id']
  WHEN 'data_table' THEN ARRAY['system_id','domain_id','technical_name','database_name','schema_name']
  WHEN 'data_field' THEN ARRAY['technical_name','technical_name_kind','source_path','source_data_type','data_type_scope','is_required','is_nullable','key_roles','code_list_id','applies_to_type_names']
  WHEN 'code_list' THEN ARRAY['domain_id','authority_organisation','normative_references']
  WHEN 'code_value' THEN ARRAY['code','short_name_de','short_name_fr','short_name_it','short_name_en']
  WHEN 'data_product' THEN ARRAY['domain_id','access_mode','access_notes','landing_page_url','formats','license_uri','license_notes','update_frequency']
  WHEN 'product_attribute' THEN ARRAY['semantic_name','value_specification','is_required']
  WHEN 'data_service' THEN ARRAY['domain_id','system_id','technical_name','service_version','purpose','access_mode','access_notes','endpoint_description_urls']
 END
END;
$$;
REVOKE ALL ON FUNCTION catalog_private.edit_columns(text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION catalog_private.api_columns(tab text, creating boolean) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
SELECT array(SELECT k FROM unnest(CASE tab
 WHEN 'actor' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','actor_type','website_url','is_archived']
 WHEN 'domain' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','contact_actor_id','parent_domain_id','is_archived']
 WHEN 'system' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','data_custodian_id','contact_actor_id','classification','contains_personal_data','system_type','technology','is_archived']
 WHEN 'business_object' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','contact_actor_id','classification','contains_personal_data','domain_id','normative_references','system_of_record_id','is_archived']
 WHEN 'business_attribute' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','contact_actor_id','classification','contains_personal_data','business_object_id','semantic_name','value_specification','is_identifier','code_list_id','sort_order','system_of_record_id','is_archived','quality_requirement_ids']
 WHEN 'data_table' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','data_custodian_id','contact_actor_id','classification','contains_personal_data','system_id','domain_id','technical_name','database_name','schema_name','is_archived']
 WHEN 'data_field' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','data_custodian_id','contact_actor_id','classification','contains_personal_data','data_table_id','technical_name','technical_name_kind','source_path','source_data_type','data_type_scope','is_required','is_nullable','key_roles','code_list_id','applies_to_type_names','sort_order','is_archived','quality_requirement_ids']
 WHEN 'code_list' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','domain_id','business_object_id','authority_organisation','normative_references','is_archived']
 WHEN 'code_value' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','code_list_id','code','short_name_de','short_name_it','short_name_fr','short_name_en','parent_code_value_id','sort_order','is_archived']
 WHEN 'data_product' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','contact_actor_id','classification','contains_personal_data','domain_id','access_mode','access_notes','landing_page_url','formats','license_uri','license_notes','update_frequency','is_archived']
 WHEN 'product_attribute' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','data_product_id','semantic_name','business_attribute_id','value_specification','is_required','sort_order','is_archived']
 WHEN 'data_service' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','data_owner_id','data_steward_id','data_custodian_id','contact_actor_id','classification','contains_personal_data','system_id','domain_id','technical_name','service_version','purpose','access_mode','access_notes','endpoint_description_urls','is_archived']
 WHEN 'service_endpoint' THEN ARRAY['id','data_service_id','identifier','url','relative_path','protocol','http_method','operation_name','environment','is_read_only','supports_bulk','authentication_methods','verification_status','sort_order','is_archived']
 WHEN 'quality_requirement' THEN ARRAY['id','identifier','name_de','name_it','name_fr','name_en','description_de','description_it','description_fr','description_en','comment','documentation_links','status','version','version_date','responsible_organisation','contact_actor_id','rule_type','comparison_value','dimension','is_archived']
 WHEN 'relationship' THEN ARRAY['id','identifier','source_business_object_id','source_data_product_id','source_data_table_id','source_data_field_id','source_data_service_id','target_business_object_id','target_business_attribute_id','target_data_table_id','target_data_field_id','target_data_service_id','relationship_type','comment','source_endpoint_id','verification_status','coverage','support_status','assessed_service_version','rule_notes_de','rule_notes_it','rule_notes_fr','rule_notes_en','documentation_links','is_archived']
 WHEN 'lineage_relation' THEN ARRAY['id','identifier','source_data_table_id','source_data_field_id','target_data_table_id','target_data_field_id','operation','transformation_notes_de','transformation_notes_it','transformation_notes_fr','transformation_notes_en','verification_status','documentation_links','is_archived']
 ELSE NULL::text[] END) k WHERE creating OR (k NOT IN ('id','identifier')
 AND NOT (tab='business_attribute' AND k='business_object_id')
 AND NOT (tab='data_field' AND k='data_table_id')
 AND NOT (tab='code_value' AND k='code_list_id')
 AND NOT (tab='product_attribute' AND k='data_product_id')
 AND NOT (tab='service_endpoint' AND k='data_service_id')
 AND NOT (tab IN ('relationship','lineage_relation') AND (k LIKE 'source\_%' ESCAPE '\' OR k LIKE 'target\_%' ESCAPE '\' OR k='relationship_type'))));
$$;
REVOKE ALL ON FUNCTION catalog_private.api_columns(text,boolean) FROM PUBLIC,anon,authenticated,service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
