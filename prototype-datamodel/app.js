// BBL Immobilienmanagement - D3.js Hierarchical Bubble Chart
// Concepts nested inside domain bubbles

(function() {
    'use strict';

    let domainData = null;
    let width, height;
    let zoom = null;
    let svg = null;
    let zoomGroup = null;

    // Mobile detection and state
    let isMobile = false;
    let isTouchDevice = false;
    let legendVisible = false;

    // Theme state
    let isLightMode = false;

    const colors = {
        muss: '#7ecba1',
        soll: '#f9d77e',
        sollte: '#f9d77e',
        kann: '#ffffff',
        könnte: '#ffffff',
        default: '#adb5bd'
    };

    const domainColors = {
        'architektonische-sicht': '#3498db',
        'projektmanagement': '#9b59b6',
        'dokumentenmanagement': '#e74c3c',
        'mietermanagement': '#1abc9c',
        'energie-ressourcen': '#2ecc71',
        'organisatorische-daten': '#f39c12',
        'workspace-management': '#e67e22',
        'finanzen': '#16a085',
        'portfoliomanagement': '#8e44ad',
        'controlling-analytics': '#2980b9',
        'objektmanagement': '#c0392b',
        'baustellenmanagement': '#d35400'
    };

    // Stroke width tokens for consistent line widths
    const stroke = {
        domain: 2,
        domainHover: 3,
        group: 1.5,
        groupHover: 2,
        concept: 1,
        conceptHover: 1.5,
        label: 1,
        leaderLine: 1.5
    };

    // Responsive scaling system - adjusts sizes based on screen width
    const BASELINE_WIDTH = 1920; // Reference width for "large screen"
    const MIN_SCALE = 0.6; // Minimum scale to prevent things from getting too small
    const MAX_INVERSE_SCALE = 1.5; // Maximum boost for small screens
    const BASE_CONCEPT_SIZE = 2.5; // Base size for concept bubbles (increase for bigger bubbles)

    function getScale() {
        const scale = Math.min(window.innerWidth, BASELINE_WIDTH) / BASELINE_WIDTH;
        return Math.max(scale, MIN_SCALE);
    }

    // Returns concept bubble value - bigger by default, even bigger on small screens
    function getConceptValue() {
        const scale = getScale();
        // Inverse: small screen gets boost, large screen stays at base
        const inverse = 1 + (1 - scale) * 0.8;
        return BASE_CONCEPT_SIZE * Math.min(inverse, MAX_INVERSE_SCALE);
    }

    // Responsive sizing helpers
    function scaledSize(baseSize) {
        return Math.round(baseSize * getScale());
    }

    // Inverse scaled size - larger on smaller screens (for bubbles)
    function inverseScaledSize(baseSize) {
        return Math.round(baseSize * getInverseScale());
    }

    // Font size tokens in rem (relative to root font size)
    // These scale automatically with the document's base font size
    const fontSizes = {
        // Bubble chart
        domainLabel: '0.8125rem',   // ~13px at 16px base
        groupLabel: '0.5625rem',    // ~9px at 16px base
        conceptLabel: '0.5rem',     // ~8px at 16px base
        // Graph view
        graphDomain: '0.6875rem',   // ~11px at 16px base
        graphGroup: '0.5625rem',    // ~9px at 16px base
        graphConcept: '0.5rem',     // ~8px at 16px base
        // Tree view
        treeRoot: '0.8125rem',      // ~13px at 16px base
        treeDomain: '0.75rem',      // ~12px at 16px base
        treeGroup: '0.625rem',      // ~10px at 16px base
        treeConcept: '0.5625rem',   // ~9px at 16px base
        treeExpand: '0.625rem'      // ~10px at 16px base
    };

    function getColor(priority) {
        const p = priority.toLowerCase();
        return colors[p] || colors.default;
    }

    function getDomainColor(domainId, alpha = 1) {
        const color = domainColors[domainId] || '#666';
        if (alpha === 1) return color;
        // Convert to rgba
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Check if device is mobile or touch-enabled
    function detectMobile() {
        isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        isMobile = window.innerWidth <= 768;
        return isMobile;
    }

    // Initialize theme from localStorage or system preference
    function initTheme() {
        const savedTheme = localStorage.getItem('ea-immo-theme');
        if (savedTheme) {
            isLightMode = savedTheme === 'light';
        } else {
            // Check system preference
            isLightMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
        }
        applyTheme();
    }

    // Apply the current theme
    function applyTheme() {
        if (isLightMode) {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
    }

    // Toggle theme (exposed to window for onclick)
    window.toggleTheme = function() {
        isLightMode = !isLightMode;
        applyTheme();
        localStorage.setItem('ea-immo-theme', isLightMode ? 'light' : 'dark');
    };

    // Initialize legend visibility based on screen size
    function initLegend() {
        const legend = document.getElementById('legend');
        const legendToggle = document.getElementById('legendToggle');

        if (isMobile) {
            legendVisible = false;
            legend.classList.remove('visible');
            legendToggle.style.display = 'block';
        } else {
            legendVisible = true;
            legend.classList.add('visible');
            legendToggle.style.display = 'none';
        }
    }

    // Toggle legend visibility (for mobile)
    window.toggleLegend = function() {
        const legend = document.getElementById('legend');
        legendVisible = !legendVisible;

        if (legendVisible) {
            legend.classList.add('visible');
        } else {
            legend.classList.remove('visible');
        }
    };

    // Search filter state
    let searchVisible = false;
    let currentSearchTerm = '';
    let currentPriorityFilter = 'all';
    let selectedDomains = new Set(); // Empty = all domains selected
    let filteredData = null;

    // Toggle search filter visibility (for mobile)
    window.toggleSearch = function() {
        const searchFilter = document.getElementById('searchFilter');
        searchVisible = !searchVisible;

        if (searchVisible) {
            searchFilter.classList.add('visible');
        } else {
            searchFilter.classList.remove('visible');
        }
    };

    // Initialize search and filter functionality
    function initSearchFilter() {
        // Populate domain filter chips
        populateDomainFilters();

        // Search input listener
        const searchInput = document.getElementById('searchInput');
        const searchClear = document.getElementById('searchClear');

        searchInput.addEventListener('input', debounce((e) => {
            currentSearchTerm = e.target.value.toLowerCase().trim();
            searchClear.style.display = currentSearchTerm ? 'flex' : 'none';
            applyFilters();
        }, 200));

        // Clear search button
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            currentSearchTerm = '';
            searchClear.style.display = 'none';
            applyFilters();
        });

        // Priority filter chip listeners
        const priorityChips = document.querySelectorAll('.filter-chip[data-filter]');
        priorityChips.forEach(chip => {
            chip.addEventListener('click', () => {
                priorityChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                currentPriorityFilter = chip.dataset.filter;
                applyFilters();
            });
        });

        // Domain filter chip listeners (delegated) - multi-select
        document.getElementById('domainFilters').addEventListener('click', (e) => {
            const chip = e.target.closest('.filter-chip');
            if (!chip) return;

            const domainId = chip.dataset.domain;
            const alleChip = document.querySelector('#domainFilters .filter-chip[data-domain="all"]');
            const domainChips = document.querySelectorAll('#domainFilters .filter-chip:not([data-domain="all"])');

            if (domainId === 'all') {
                // "Alle" resets selection - clear all and show everything
                selectedDomains.clear();
                domainChips.forEach(c => c.classList.remove('active'));
                alleChip.classList.add('active');
            } else {
                // Toggle individual domain
                if (selectedDomains.has(domainId)) {
                    selectedDomains.delete(domainId);
                    chip.classList.remove('active');
                } else {
                    selectedDomains.add(domainId);
                    chip.classList.add('active');
                }

                // Update "Alle" chip state
                if (selectedDomains.size === 0) {
                    alleChip.classList.add('active');
                } else {
                    alleChip.classList.remove('active');
                }
            }
            applyFilters();
        });

        // Initialize search filter visibility for desktop
        const searchFilter = document.getElementById('searchFilter');
        const searchToggle = document.getElementById('searchToggle');
        if (!isMobile) {
            searchFilter.classList.add('visible');
            searchToggle.style.display = 'none';
        } else {
            searchFilter.classList.remove('visible');
            searchToggle.style.display = 'block';
        }
    }

    // Populate domain filter chips dynamically
    function populateDomainFilters() {
        const container = document.getElementById('domainFilters');
        let html = '<button class="filter-chip active" data-domain="all">Alle</button>';

        domainData.domains.forEach(domain => {
            const shortName = domain.shortName || domain.name.split(' ')[0];
            const color = getDomainColor(domain.id);
            html += `<button class="filter-chip" data-domain="${domain.id}" style="--chip-color: ${color}">
                <span class="chip-dot" style="background: ${color}"></span>${shortName}
            </button>`;
        });

        container.innerHTML = html;
    }

    // Debounce helper
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Apply all filters and update visualization
    function applyFilters() {
        // Create filtered data structure
        filteredData = {
            domains: domainData.domains.map(domain => {
                // Check domain filter (empty Set = all domains)
                if (selectedDomains.size > 0 && !selectedDomains.has(domain.id)) {
                    return { ...domain, groups: [] };
                }

                const filteredGroups = (domain.groups || []).map(group => {
                    const filteredConcepts = (group.concepts || []).filter(concept => {
                        // Priority filter
                        if (currentPriorityFilter !== 'all') {
                            const priority = concept.priority.toLowerCase();
                            if (currentPriorityFilter === 'muss' && priority !== 'muss') return false;
                            if (currentPriorityFilter === 'soll' && !priority.includes('soll')) return false;
                            if (currentPriorityFilter === 'kann' && !priority.includes('kann') && !priority.includes('könn')) return false;
                        }

                        // Search filter
                        if (currentSearchTerm) {
                            const searchableText = [
                                concept.name,
                                concept.description || '',
                                concept.standards || '',
                                group.name,
                                domain.name
                            ].join(' ').toLowerCase();

                            if (!searchableText.includes(currentSearchTerm)) return false;
                        }

                        return true;
                    });

                    return { ...group, concepts: filteredConcepts };
                }).filter(group => group.concepts.length > 0);

                return { ...domain, groups: filteredGroups };
            })
        };

        // Update counts
        updateFilterCounts();

        // Re-render current view
        rerenderCurrentView();
    }

    // Update filter result counts
    function updateFilterCounts() {
        let totalConcepts = 0;
        let filteredConcepts = 0;

        domainData.domains.forEach(d => {
            if (d.groups) {
                d.groups.forEach(g => {
                    if (g.concepts) totalConcepts += g.concepts.length;
                });
            }
        });

        filteredData.domains.forEach(d => {
            if (d.groups) {
                d.groups.forEach(g => {
                    if (g.concepts) filteredConcepts += g.concepts.length;
                });
            }
        });

        document.getElementById('filteredCount').textContent = filteredConcepts;
        document.getElementById('totalCount').textContent = totalConcepts;
        document.getElementById('legendTotal').textContent = filteredConcepts;
    }

    // Re-render the current view with filtered data
    function rerenderCurrentView() {
        const chartEl = document.getElementById('chart');
        const graphEl = document.getElementById('graphView');
        const treeEl = document.getElementById('treeView');
        const tableEl = document.getElementById('tableView');

        if (chartEl.style.display !== 'none') {
            render();
        } else if (graphEl.style.display !== 'none') {
            // Clear and re-render graph
            graphSvg.selectAll('*').remove();
            renderGraph();
        } else if (treeEl.style.display !== 'none') {
            // Re-render tree
            renderTree();
        } else if (tableEl.style.display !== 'none') {
            // Clear and re-render table
            document.getElementById('tableBody').innerHTML = '';
            renderTable();
        }
    }

    // Get data for rendering (filtered or original)
    function getRenderData() {
        return filteredData || domainData;
    }

    async function init() {
        try {
            detectMobile();
            initTheme();
            const response = await fetch('data/Konzepte.json');
            domainData = await response.json();
            filteredData = domainData; // Initialize filtered data
            setupChart();
            render();
            initLegend();
            initSearchFilter();
            // Initialize Lucide icons
            if (window.lucide) {
                window.lucide.createIcons();
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }

    function setupChart() {
        width = window.innerWidth;
        height = window.innerHeight;

        d3.select('#chart')
            .attr('width', width)
            .attr('height', height);

        window.addEventListener('resize', () => {
            const wasMobile = isMobile;
            width = window.innerWidth;
            height = window.innerHeight;
            detectMobile();

            // Update legend and search visibility on screen size change
            if (wasMobile !== isMobile) {
                initLegend();
                // Update search filter visibility
                const searchFilter = document.getElementById('searchFilter');
                const searchToggle = document.getElementById('searchToggle');
                if (!isMobile) {
                    searchFilter.classList.add('visible');
                    searchToggle.style.display = 'none';
                } else {
                    searchFilter.classList.remove('visible');
                    searchToggle.style.display = 'block';
                }
            }

            d3.select('#chart').attr('width', width).attr('height', height);
            render();
        });
    }

    function render() {
        svg = d3.select('#chart');
        svg.selectAll('*').remove();

        // Setup zoom behavior
        zoom = d3.zoom()
            .scaleExtent([0.3, 4])
            .on('zoom', (event) => {
                zoomGroup.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Create a group for all zoomable content
        zoomGroup = svg.append('g')
            .attr('class', 'zoom-group');

        // Build hierarchy data with 3 levels: domain > group > concept
        const renderData = getRenderData();
        const hierarchyData = {
            name: 'root',
            children: renderData.domains.map(domain => {
                const groups = [];
                if (domain.groups && domain.groups.length > 0) {
                    domain.groups.forEach(g => {
                        if (g.concepts && g.concepts.length > 0) {
                            groups.push({
                                name: g.name,
                                isGroup: true,
                                domainId: domain.id,
                                domainName: domain.name,
                                children: g.concepts.map(c => ({
                                    name: c.name,
                                    value: getConceptValue(), // Bigger bubbles by default, even bigger on small screens
                                    priority: c.priority,
                                    concept: c,
                                    domainName: domain.name,
                                    groupName: g.name
                                }))
                            });
                        }
                    });
                }
                // Add placeholder if no groups
                if (groups.length === 0) {
                    groups.push({
                        name: 'Keine Konzepte',
                        isGroup: true,
                        placeholder: true,
                        domainId: domain.id,
                        domainName: domain.name,
                        children: [{
                            name: '-',
                            value: getConceptValue(), // Consistent with other bubbles
                            priority: 'default',
                            placeholder: true,
                            domainName: domain.name
                        }]
                    });
                }
                return {
                    name: domain.shortName || domain.name,
                    fullName: domain.name,
                    id: domain.id,
                    domain: domain,
                    children: groups
                };
            })
        };

        // Create pack layout with padding for each level (responsive)
        // On smaller screens: less padding = more space for bubbles = larger bubbles
        const paddingScale = getScale() * getScale(); // Quadratic reduction for more aggressive padding decrease
        const pack = d3.pack()
            .size([width - Math.round(40 * paddingScale), height - Math.round(100 * paddingScale)])
            .padding(d => {
                if (d.depth === 0) return Math.max(15, Math.round(40 * paddingScale));  // Between domains
                if (d.depth === 1) return Math.max(4, Math.round(8 * paddingScale));    // Between groups in domain
                return Math.max(2, Math.round(3 * paddingScale));                        // Between concepts in group
            });

        const root = d3.hierarchy(hierarchyData)
            .sum(d => d.value || 0)
            .sort((a, b) => b.value - a.value);

        pack(root);

        // Calculate total concepts
        let totalConcepts = 0;
        renderData.domains.forEach(d => {
            if (d.groups) {
                d.groups.forEach(g => {
                    if (g.concepts) totalConcepts += g.concepts.length;
                });
            }
        });
        document.getElementById('legendTotal').textContent = totalConcepts;

        // Create container group with offset for header
        const g = zoomGroup.append('g')
            .attr('transform', 'translate(20, 70)');

        // Draw domain circles (depth 1)
        const domainNodes = root.descendants().filter(d => d.depth === 1);

        const domainGroups = g.selectAll('.domain-group')
            .data(domainNodes)
            .enter()
            .append('g')
            .attr('class', 'domain-group')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);

        // Domain background circles
        domainGroups.append('circle')
            .attr('r', d => d.r)
            .attr('fill', d => getDomainColor(d.data.id, 0.12))
            .attr('stroke', d => getDomainColor(d.data.id))
            .attr('stroke-width', stroke.domain)
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                event.stopPropagation();
                showDomainPopup(d.data.domain);
            });

        // Domain labels - positioned outside at top with background
        const labels = domainGroups.append('g')
            .attr('transform', d => `translate(0, ${-d.r - 18})`);

        // Helper to count concepts in domain
        function countDomainConcepts(domain) {
            let count = 0;
            if (domain.groups) {
                domain.groups.forEach(g => {
                    if (g.concepts) count += g.concepts.length;
                });
            }
            return count;
        }

        // Get truncated domain label text based on screen size
        function getDomainLabelText(d) {
            const count = countDomainConcepts(d.data.domain);
            const name = d.data.name;
            // Truncate domain names more on smaller screens
            const maxLen = isMobile ? 12 : (width < 1200 ? 18 : 30);
            const truncatedName = name.length > maxLen ? name.substring(0, maxLen - 2) + '..' : name;
            return truncatedName + ' (' + count + ')';
        }

        // Label background - sized to fit text with count
        labels.append('rect')
            .attr('x', d => {
                const text = getDomainLabelText(d);
                return -(text.length * 4 + 12);
            })
            .attr('y', -14)
            .attr('width', d => {
                const text = getDomainLabelText(d);
                return text.length * 8 + 24;
            })
            .attr('height', 28)
            .attr('rx', 6)
            .attr('fill', d => getDomainColor(d.data.id))
            .attr('opacity', 0.95);

        // Label text - full name with count (truncated on small screens)
        labels.append('text')
            .attr('y', 5)
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .attr('font-size', fontSizes.domainLabel)
            .attr('font-weight', 'bold')
            .style('pointer-events', 'none')
            .text(d => getDomainLabelText(d));

        // Leader lines connecting domain labels to circles
        domainGroups.append('line')
            .attr('x1', 0)
            .attr('y1', d => -d.r + 4)  // Just inside the circle top edge
            .attr('x2', 0)
            .attr('y2', d => -d.r - 4)  // Bottom of label (18 offset - 14 half height)
            .attr('stroke', d => getDomainColor(d.data.id))
            .attr('stroke-width', stroke.leaderLine)
            .attr('stroke-dasharray', '4,3')
            .attr('opacity', 0.7);

        // Draw group circles (depth 2)
        const groupNodes = root.descendants().filter(d => d.depth === 2);

        const groupGroups = g.selectAll('.group-group')
            .data(groupNodes)
            .enter()
            .append('g')
            .attr('class', 'group-group')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);

        // Group background circles
        groupGroups.append('circle')
            .attr('r', d => d.r)
            .attr('fill', d => d.data.placeholder ? 'rgba(100,100,100,0.1)' : getDomainColor(d.data.domainId, 0.2))
            .attr('stroke', d => d.data.placeholder ? 'transparent' : getDomainColor(d.data.domainId, 0.4))
            .attr('stroke-width', stroke.group)
            .attr('stroke-dasharray', '4,2');

        // Helper to get group label text with count
        function getGroupLabelText(d) {
            const count = d.data.children ? d.data.children.length : 0;
            const baseName = d.data.name.length > 14 ? d.data.name.substring(0, 12) + '..' : d.data.name;
            return baseName + ' (' + count + ')';
        }

        // Store group nodes for label rendering later (to ensure z-order)
        const groupLabelNodes = groupNodes.filter(d => !d.data.placeholder && d.r > 35);

        // Draw concept circles (depth 3)
        const conceptNodes = root.descendants().filter(d => d.depth === 3);

        const conceptGroups = g.selectAll('.concept-group')
            .data(conceptNodes)
            .enter()
            .append('g')
            .attr('class', 'concept-group')
            .attr('transform', d => `translate(${d.x}, ${d.y})`)
            .style('cursor', d => d.data.placeholder ? 'default' : 'pointer');

        // Concept circles
        conceptGroups.append('circle')
            .attr('r', d => d.r)
            .attr('fill', d => d.data.placeholder ? 'rgba(150,150,150,0.3)' : getColor(d.data.priority))
            .attr('stroke', d => d.data.placeholder ? 'transparent' : '#555')
            .attr('stroke-width', stroke.concept)
            .attr('opacity', d => d.data.placeholder ? 0.5 : 0.9);

        // ── Concept labels: resolve overlaps with bidirectional offsets ──
        const realConceptNodes = conceptNodes.filter(d => !d.data.placeholder);

        // Step 1: Build label metadata (all centered by default)
        const labelInfo = realConceptNodes.map(d => ({
            node: d,
            x: d.x,
            y: d.y,
            width: d.data.name.length * 5.4 + 6, // ~9px font avg char width + padding
            height: 12,
            offset: 0,   // 0 = centered on circle; negative = above; positive = below
            radius: d.r
        }));

        // Step 2: Overlap test using current offset positions
        function labelsOverlap(a, b, padding) {
            padding = padding || 2;
            var dx = Math.abs(a.x - b.x);
            var ay = a.y + a.offset;
            var by = b.y + b.offset;
            var dy = Math.abs(ay - by);
            return dx < (a.width + b.width) / 2 + padding
                && dy < (a.height + b.height) / 2 + padding;
        }

        // Step 3: Iteratively resolve overlaps (max 5 passes)
        // Key insight: offset by label height, not circle radius
        var halfLabelHeight = 0.7; // nudge amount per collision

        for (var iter = 0; iter < 5; iter++) {
            var anyOverlap = false;

            for (var i = 0; i < labelInfo.length; i++) {
                for (var j = i + 1; j < labelInfo.length; j++) {
                    var a = labelInfo[i];
                    var b = labelInfo[j];

                    if (!labelsOverlap(a, b)) continue;
                    anyOverlap = true;

                    // Nudge labels apart by half label height each
                    // Higher label goes up, lower label goes down
                    if ((a.y + a.offset) <= (b.y + b.offset)) {
                        a.offset -= halfLabelHeight;
                        b.offset += halfLabelHeight;
                    } else {
                        a.offset += halfLabelHeight;
                        b.offset -= halfLabelHeight;
                    }
                }
            }

            if (!anyOverlap) break;
        }

        // Step 4: Build offset lookup
        var offsetMap = new Map();
        labelInfo.forEach(function(info) {
            offsetMap.set(info.node, info.offset);
        });

        // Render all labels in a separate layer on top of all circles
        var labelsLayer = g.append('g').attr('class', 'labels-layer');

        // Group labels (rendered first, so concept labels appear on top)
        var groupLabels = labelsLayer.selectAll('.group-label')
            .data(groupLabelNodes)
            .enter()
            .append('g')
            .attr('class', 'group-label')
            .attr('transform', d => `translate(${d.x}, ${d.y - d.r + 12})`);

        // Group label background pill
        groupLabels.append('rect')
            .attr('x', d => -(getGroupLabelText(d).length * 3.5 + 8))
            .attr('y', -9)
            .attr('width', d => getGroupLabelText(d).length * 7 + 16)
            .attr('height', 18)
            .attr('rx', 9)
            .attr('fill', 'rgba(0, 0, 0, 0.6)')
            .attr('stroke', d => getDomainColor(d.data.domainId, 0.6))
            .attr('stroke-width', stroke.label);

        // Group label text
        groupLabels.append('text')
            .attr('y', 4)
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .attr('font-size', fontSizes.groupLabel)
            .attr('font-weight', '500')
            .style('pointer-events', 'none')
            .text(d => getGroupLabelText(d));

        // Concept labels (rendered last, on top of everything)
        labelsLayer.selectAll('.concept-label')
            .data(realConceptNodes)
            .enter()
            .append('text')
            .attr('class', 'concept-label')
            .attr('transform', d => `translate(${d.x}, ${d.y})`)
            .attr('text-anchor', 'middle')
            .attr('y', d => offsetMap.get(d) || 0)
            .attr('dy', '0.35em')
            .attr('fill', isLightMode ? '#2c3e50' : '#e2e8f0')
            .attr('font-size', fontSizes.conceptLabel)
            .attr('font-weight', '500')
            .style('pointer-events', 'none')
            .text(d => d.data.name);

        // Concept interactions - with touch support
        conceptGroups.filter(d => !d.data.placeholder)
            .on('mouseenter', function(event, d) {
                d3.select(this).select('circle')
                    .attr('opacity', 1)
                    .attr('stroke-width', stroke.conceptHover);
                showTooltip(event, d.data.name, d.data.groupName + ' · ' + d.data.domainName);
            })
            .on('mousemove', (event) => moveTooltip(event))
            .on('mouseleave', function() {
                d3.select(this).select('circle')
                    .attr('opacity', 0.9)
                    .attr('stroke-width', stroke.concept);
                hideTooltip();
            })
            .on('click', (event, d) => {
                event.stopPropagation();
                showConceptPopup(d.data.concept, d.data.domainName);
            })
            .on('touchstart', function(event, d) {
                event.preventDefault();
                d3.select(this).select('circle')
                    .attr('opacity', 1)
                    .attr('stroke-width', stroke.conceptHover);
            }, { passive: false })
            .on('touchend', function(event, d) {
                event.preventDefault();
                d3.select(this).select('circle')
                    .attr('opacity', 0.9)
                    .attr('stroke-width', stroke.concept);
                showConceptPopup(d.data.concept, d.data.domainName);
            }, { passive: false });

        // Domain interactions - with touch support
        domainGroups
            .on('mouseenter', function() {
                d3.select(this).select('circle').attr('stroke-width', stroke.domainHover);
            })
            .on('mouseleave', function() {
                d3.select(this).select('circle').attr('stroke-width', stroke.domain);
            })
            .on('touchstart', function(event) {
                event.preventDefault();
                d3.select(this).select('circle').attr('stroke-width', stroke.domainHover);
            }, { passive: false })
            .on('touchend', function(event, d) {
                event.preventDefault();
                d3.select(this).select('circle').attr('stroke-width', stroke.domain);
                showDomainPopup(d.data.domain);
            }, { passive: false });

        // Group interactions - with touch support
        groupGroups.filter(d => !d.data.placeholder)
            .style('cursor', 'pointer')
            .on('mouseenter', function(event, d) {
                d3.select(this).select('circle').attr('stroke-width', stroke.groupHover);
                showTooltip(event, d.data.name, d.data.domainName);
            })
            .on('mousemove', (event) => moveTooltip(event))
            .on('mouseleave', function() {
                d3.select(this).select('circle').attr('stroke-width', stroke.group);
                hideTooltip();
            })
            .on('touchstart', function(event) {
                event.preventDefault();
                d3.select(this).select('circle').attr('stroke-width', stroke.groupHover);
            }, { passive: false })
            .on('touchend', function(event, d) {
                event.preventDefault();
                d3.select(this).select('circle').attr('stroke-width', stroke.group);
                // For groups, show tooltip briefly then hide
                const touch = event.changedTouches[0];
                showTooltip({ clientX: touch.clientX, clientY: touch.clientY }, d.data.name, d.data.domainName);
            }, { passive: false });
    }

    // Tooltip functions with touch support
    let tooltipTimeout = null;

    function showTooltip(event, title, subtitle) {
        // Skip tooltip on touch devices for better UX (use tap for popup instead)
        if (isTouchDevice && event.type && event.type.startsWith('touch')) {
            return;
        }

        const tooltip = document.getElementById('tooltip');
        document.getElementById('tooltipTitle').textContent = title;
        document.getElementById('tooltipDomain').textContent = subtitle;
        tooltip.classList.add('visible');
        moveTooltip(event);

        // Auto-hide tooltip on touch after 2 seconds
        if (isTouchDevice) {
            clearTimeout(tooltipTimeout);
            tooltipTimeout = setTimeout(hideTooltip, 2000);
        }
    }

    function moveTooltip(event) {
        const tooltip = document.getElementById('tooltip');
        let x, y;

        // Handle both mouse and touch events
        if (event.touches && event.touches.length > 0) {
            x = event.touches[0].clientX;
            y = event.touches[0].clientY;
        } else {
            x = event.clientX;
            y = event.clientY;
        }

        // Position tooltip, ensuring it stays within viewport
        const tooltipRect = tooltip.getBoundingClientRect();
        const padding = 15;

        let left = x + padding;
        let top = y + padding;

        // Adjust if tooltip would go off screen
        if (left + tooltipRect.width > window.innerWidth) {
            left = x - tooltipRect.width - padding;
        }
        if (top + tooltipRect.height > window.innerHeight) {
            top = y - tooltipRect.height - padding;
        }

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    function hideTooltip() {
        document.getElementById('tooltip').classList.remove('visible');
        clearTimeout(tooltipTimeout);
    }

    // Popup functions
    function showConceptPopup(concept, domainName) {
        const overlay = document.getElementById('popupOverlay');
        const title = document.getElementById('popupTitle');
        const subtitle = document.getElementById('popupSubtitle');
        const content = document.getElementById('popupContent');

        title.textContent = concept.name;
        subtitle.textContent = domainName;

        const priorityClass = concept.priority.toLowerCase();

        let html = `<span class="priority-badge ${priorityClass}">${concept.priority}</span>`;
        html += `<div class="popup-description">${concept.description}</div>`;

        if (concept.standards) {
            html += `
                <div class="popup-section">
                    <div class="popup-section-title">Relevante Standards</div>
                    <div class="standards-list">
                        ${concept.standards.split(',').map(s => `<span class="standard-tag">${s.trim()}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        if (concept.comment) {
            html += `
                <div class="popup-section">
                    <div class="popup-section-title">Kommentar</div>
                    <p style="font-size: 0.9rem; color: #555;">${concept.comment}</p>
                </div>
            `;
        }

        content.innerHTML = html;
        overlay.classList.add('active');
    }

    function showDomainPopup(domain) {
        const overlay = document.getElementById('popupOverlay');
        const title = document.getElementById('popupTitle');
        const subtitle = document.getElementById('popupSubtitle');
        const content = document.getElementById('popupContent');

        let conceptCount = 0;
        if (domain.groups) {
            domain.groups.forEach(g => {
                if (g.concepts) conceptCount += g.concepts.length;
            });
        }

        title.textContent = domain.name;
        subtitle.textContent = domain.subtitle || `${conceptCount} Konzepte`;

        let html = '';

        if (domain.description) {
            html += `<div class="popup-description">${domain.description}</div>`;
        }

        if (domain.standards && domain.standards.length > 0) {
            html += `
                <div class="popup-section">
                    <div class="popup-section-title">Standards</div>
                    <div class="standards-list">
                        ${domain.standards.map(s => `<span class="standard-tag">${s}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        if (domain.groups && domain.groups.length > 0) {
            domain.groups.forEach(group => {
                if (group.concepts && group.concepts.length > 0) {
                    html += `
                        <div class="popup-section">
                            <div class="popup-section-title">${group.name}</div>
                            <div class="standards-list">
                    `;
                    group.concepts.forEach(concept => {
                        const bg = getColor(concept.priority);
                        html += `<span class="concept-tag" style="background: ${bg};"
                            onclick="window.showConceptFromDomain('${encodeURIComponent(JSON.stringify(concept))}', '${domain.name}')">${concept.name}</span>`;
                    });
                    html += `</div></div>`;
                }
            });
        } else {
            html += `<p style="color: #888; font-style: italic;">Keine Konzepte für diese Domäne definiert.</p>`;
        }

        content.innerHTML = html;
        overlay.classList.add('active');
    }

    window.showConceptFromDomain = function(encoded, domainName) {
        const concept = JSON.parse(decodeURIComponent(encoded));
        showConceptPopup(concept, domainName);
    };

    window.closePopup = function(event) {
        if (!event || event.target.id === 'popupOverlay') {
            document.getElementById('popupOverlay').classList.remove('active');
        }
    };

    // View toggle
    window.setView = function(view) {
        const chartEl = document.getElementById('chart');
        const graphEl = document.getElementById('graphView');
        const treeEl = document.getElementById('treeView');
        const tableEl = document.getElementById('tableView');
        const legendEl = document.getElementById('legend');
        const legendToggle = document.getElementById('legendToggle');
        const searchFilterEl = document.getElementById('searchFilter');
        const searchToggle = document.getElementById('searchToggle');
        const zoomEl = document.querySelector('.zoom-controls');
        const buttons = document.querySelectorAll('.toggle-btn');

        buttons.forEach(btn => btn.classList.remove('active'));

        chartEl.style.display = 'none';
        graphEl.style.display = 'none';
        treeEl.style.display = 'none';
        tableEl.style.display = 'none';

        if (view === 'chart') {
            chartEl.style.display = 'block';
            legendEl.style.display = 'block';
            legendToggle.style.display = isMobile ? 'block' : 'none';
            searchFilterEl.style.display = 'block';
            searchToggle.style.display = isMobile ? 'block' : 'none';
            zoomEl.style.display = 'flex';
            buttons[0].classList.add('active');
        } else if (view === 'graph') {
            graphEl.style.display = 'block';
            legendEl.style.display = 'block';
            legendToggle.style.display = isMobile ? 'block' : 'none';
            searchFilterEl.style.display = 'block';
            searchToggle.style.display = isMobile ? 'block' : 'none';
            zoomEl.style.display = 'flex';
            buttons[1].classList.add('active');
            renderGraph();
        } else if (view === 'tree') {
            treeEl.style.display = 'block';
            legendEl.style.display = 'block';
            legendToggle.style.display = isMobile ? 'block' : 'none';
            searchFilterEl.style.display = 'block';
            searchToggle.style.display = isMobile ? 'block' : 'none';
            zoomEl.style.display = 'flex';
            buttons[2].classList.add('active');
            renderTree();
        } else {
            tableEl.style.display = 'block';
            legendEl.style.display = 'none';
            legendToggle.style.display = 'none';
            searchFilterEl.style.display = 'none';
            searchToggle.style.display = 'none';
            zoomEl.style.display = 'none';
            buttons[3].classList.add('active');
            renderTable();
        }

        // Hide legend and search on mobile when switching views
        if (isMobile && view !== 'table') {
            legendVisible = false;
            legendEl.classList.remove('visible');
            searchVisible = false;
            searchFilterEl.classList.remove('visible');
        }
    };

    let graphSvg = null;
    let graphZoom = null;
    let graphSimulation = null;

    function renderGraph() {
        graphSvg = d3.select('#graphView');

        // Check if already rendered
        if (graphSvg.select('.graph-container').size() > 0) return;

        graphSvg
            .attr('width', width)
            .attr('height', height);

        // Setup zoom for graph
        graphZoom = d3.zoom()
            .scaleExtent([0.2, 4])
            .on('zoom', (event) => {
                graphSvg.select('.graph-container').attr('transform', event.transform);
            });

        graphSvg.call(graphZoom);

        const container = graphSvg.append('g')
            .attr('class', 'graph-container');

        // Build nodes and links for 3 levels: domain > group > concept
        const renderData = getRenderData();
        const nodes = [];
        const links = [];

        // Create domain nodes
        renderData.domains.forEach(domain => {
            nodes.push({
                id: 'domain:' + domain.id,
                name: domain.shortName || domain.name,
                type: 'domain',
                domain: domain,
                domainId: domain.id,
                priority: domain.priority
            });
        });

        // Create group and concept nodes
        renderData.domains.forEach(domain => {
            if (!domain.groups) return;

            domain.groups.forEach(group => {
                if (!group.concepts || group.concepts.length === 0) return;

                const groupId = 'group:' + domain.id + '/' + group.name;

                // Group node
                nodes.push({
                    id: groupId,
                    name: group.name,
                    type: 'group',
                    domain: domain,
                    domainId: domain.id,
                    groupName: group.name
                });

                // Link domain to group
                links.push({
                    source: 'domain:' + domain.id,
                    target: groupId,
                    type: 'domain-group',
                    domainId: domain.id
                });

                // Concept nodes
                group.concepts.forEach(concept => {
                    const conceptId = 'concept:' + domain.id + '/' + group.name + '/' + concept.name;

                    nodes.push({
                        id: conceptId,
                        name: concept.name,
                        type: 'concept',
                        concept: concept,
                        domain: domain,
                        domainId: domain.id,
                        groupName: group.name,
                        priority: concept.priority
                    });

                    // Link group to concept
                    links.push({
                        source: groupId,
                        target: conceptId,
                        type: 'group-concept',
                        domainId: domain.id
                    });
                });
            });
        });

        // Create inter-domain links
        if (domainData.connections) {
            domainData.connections.forEach(conn => {
                links.push({
                    source: 'domain:' + conn.from,
                    target: 'domain:' + conn.to,
                    type: 'domain-domain'
                });
            });
        }

        // Node size based on type (responsive)
        function getNodeRadius(d) {
            if (d.type === 'domain') return scaledSize(30);
            if (d.type === 'group') return scaledSize(16);
            return scaledSize(8);
        }

        // Create force simulation with more spacing
        graphSimulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links)
                .id(d => d.id)
                .distance(d => {
                    if (d.type === 'domain-domain') return 400;
                    if (d.type === 'domain-group') return 120;
                    return 70;
                })
                .strength(d => {
                    if (d.type === 'domain-domain') return 0.03;
                    if (d.type === 'domain-group') return 0.2;
                    return 0.4;
                }))
            .force('charge', d3.forceManyBody()
                .strength(d => {
                    if (d.type === 'domain') return -800;
                    if (d.type === 'group') return -200;
                    return -80;
                }))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => getNodeRadius(d) + 25))
            .force('x', d3.forceX(width / 2).strength(0.01))
            .force('y', d3.forceY(height / 2).strength(0.01));

        // Draw links
        const link = container.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(links)
            .enter()
            .append('line')
            .attr('class', d => 'graph-link ' + d.type)
            .attr('stroke', d => {
                if (d.type === 'domain-domain') return 'rgba(255,255,255,0.3)';
                return getDomainColor(d.domainId, 0.4);
            })
            .attr('stroke-width', d => {
                if (d.type === 'domain-domain') return stroke.domain;
                if (d.type === 'domain-group') return stroke.group;
                return stroke.concept;
            })
            .attr('stroke-dasharray', d => d.type === 'domain-domain' ? '8,4' : null);

        // Draw nodes
        const node = container.append('g')
            .attr('class', 'nodes')
            .selectAll('g')
            .data(nodes)
            .enter()
            .append('g')
            .attr('class', d => 'graph-node graph-node-' + d.type)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        // Node circles
        node.append('circle')
            .attr('r', d => getNodeRadius(d))
            .attr('fill', d => {
                if (d.type === 'domain') return getDomainColor(d.domainId);
                if (d.type === 'group') return getDomainColor(d.domainId, 0.6);
                return getColor(d.priority);
            })
            .attr('stroke', d => {
                if (d.type === 'domain') return '#fff';
                if (d.type === 'group') return getDomainColor(d.domainId);
                return '#555';
            })
            .attr('stroke-width', d => d.type === 'domain' ? stroke.domain : d.type === 'group' ? stroke.group : stroke.concept);

        // Helper to get label text - show full name
        function getLabelText(d) {
            return d.name;
        }

        // Label backgrounds for group and concept nodes
        node.filter(d => d.type !== 'domain')
            .append('rect')
            .attr('class', 'label-bg')
            .attr('y', d => -getNodeRadius(d) - 16)
            .attr('height', 14)
            .attr('rx', 3)
            .attr('fill', 'rgba(0, 0, 0, 0.75)')
            .attr('x', function(d) {
                const text = getLabelText(d);
                const fontSize = d.type === 'group' ? 9 : 8;
                const width = text.length * fontSize * 0.55 + 8;
                return -width / 2;
            })
            .attr('width', function(d) {
                const text = getLabelText(d);
                const fontSize = d.type === 'group' ? 9 : 8;
                return text.length * fontSize * 0.55 + 8;
            });

        // Node labels
        node.append('text')
            .attr('class', 'graph-label')
            .attr('dy', d => d.type === 'domain' ? 5 : -getNodeRadius(d) - 5)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fff')
            .attr('font-size', d => d.type === 'domain' ? fontSizes.graphDomain : d.type === 'group' ? fontSizes.graphGroup : fontSizes.graphConcept)
            .attr('font-weight', d => d.type === 'domain' ? 'bold' : '500')
            .text(d => getLabelText(d));

        // Node interactions - with touch support
        node.on('mouseenter', function(event, d) {
            const r = getNodeRadius(d);
            d3.select(this).select('circle')
                .attr('r', r * 1.2)
                .attr('stroke-width', d.type === 'domain' ? stroke.domainHover : d.type === 'group' ? stroke.groupHover : stroke.conceptHover);

            if (d.type === 'domain') {
                showTooltip(event, d.domain.name, d.domain.priority + ' · ' + (d.domain.standards || []).slice(0, 3).join(', '));
            } else if (d.type === 'group') {
                showTooltip(event, d.name, d.domain.name);
            } else {
                showTooltip(event, d.name, d.groupName + ' · ' + d.domain.name);
            }
        })
        .on('mousemove', (event) => moveTooltip(event))
        .on('mouseleave', function(event, d) {
            d3.select(this).select('circle')
                .attr('r', getNodeRadius(d))
                .attr('stroke-width', d.type === 'domain' ? stroke.domain : d.type === 'group' ? stroke.group : stroke.concept);
            hideTooltip();
        })
        .on('click', (event, d) => {
            event.stopPropagation();
            if (d.type === 'domain') {
                showDomainPopup(d.domain);
            } else if (d.type === 'concept') {
                showConceptPopup(d.concept, d.domain.name);
            }
        });

        // Touch-specific interactions for nodes (tap to show popup)
        node.on('touchend', function(event, d) {
            // Only trigger if it's a tap, not a drag
            if (event.defaultPrevented) return;

            event.preventDefault();
            event.stopPropagation();

            if (d.type === 'domain') {
                showDomainPopup(d.domain);
            } else if (d.type === 'concept') {
                showConceptPopup(d.concept, d.domain.name);
            }
        });

        // Tick function
        graphSimulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node.attr('transform', d => `translate(${d.x}, ${d.y})`);
        });

        // Drag functions
        function dragstarted(event, d) {
            if (!event.active) graphSimulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) graphSimulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
    }

    // Tree view state
    let treeSvg = null;
    let treeZoom = null;
    let treeRoot = null;

    function renderTree() {
        treeSvg = d3.select('#treeView');

        // Clear any existing content
        treeSvg.selectAll('*').remove();

        treeSvg
            .attr('width', width)
            .attr('height', height);

        // Setup zoom for tree
        treeZoom = d3.zoom()
            .scaleExtent([0.2, 4])
            .on('zoom', (event) => {
                treeSvg.select('.tree-container').attr('transform', event.transform);
            });

        treeSvg.call(treeZoom);

        const container = treeSvg.append('g')
            .attr('class', 'tree-container');

        // Build hierarchical data: root > domains > groups > concepts
        const renderData = getRenderData();
        const hierarchyData = {
            name: 'Domänenmodell',
            children: renderData.domains.map(domain => ({
                name: domain.shortName || domain.name,
                fullName: domain.name,
                id: domain.id,
                type: 'domain',
                domain: domain,
                children: (domain.groups || []).filter(g => g.concepts && g.concepts.length > 0).map(group => ({
                    name: group.name,
                    type: 'group',
                    domainId: domain.id,
                    domainName: domain.name,
                    children: group.concepts.map(concept => ({
                        name: concept.name,
                        type: 'concept',
                        concept: concept,
                        domainId: domain.id,
                        domainName: domain.name,
                        groupName: group.name,
                        priority: concept.priority
                    }))
                }))
            }))
        };

        // Create the hierarchy
        treeRoot = d3.hierarchy(hierarchyData);

        // All nodes expanded by default (no collapsing)

        // Tree layout parameters
        const nodeWidth = 220;
        const nodeHeight = 28;

        // Diagonal link generator
        const diagonal = d3.linkHorizontal()
            .x(d => d.y)
            .y(d => d.x);

        // Function to update the tree
        function update(source) {
            const duration = 300;

            // Compute the new tree layout
            const treeLayout = d3.tree()
                .nodeSize([nodeHeight, nodeWidth]);

            treeLayout(treeRoot);

            // Get all nodes and links
            const nodes = treeRoot.descendants();
            const links = treeRoot.links();

            // Normalize for fixed-depth and center vertically
            nodes.forEach(d => {
                d.y = d.depth * nodeWidth;
            });

            // Center the tree both vertically and horizontally
            const minX = d3.min(nodes, d => d.x);
            const maxX = d3.max(nodes, d => d.x);
            const maxY = d3.max(nodes, d => d.y);
            const treeWidth = maxY + 150; // tree width plus some padding for labels
            const offsetY = height / 2 - (minX + maxX) / 2;
            const offsetX = Math.max(100, (width - treeWidth) / 2);

            // Update links
            const link = container.selectAll('.tree-link')
                .data(links, d => d.target.data.name + d.target.depth);

            // Enter links
            const linkEnter = link.enter()
                .insert('path', 'g')
                .attr('class', 'tree-link')
                .attr('d', d => {
                    const o = { x: source.x0 !== undefined ? source.x0 + offsetY : source.x + offsetY, y: source.y0 !== undefined ? source.y0 + offsetX : source.y + offsetX };
                    return diagonal({ source: o, target: o });
                });

            // Merge and transition links
            link.merge(linkEnter)
                .transition()
                .duration(duration)
                .attr('d', d => diagonal({
                    source: { x: d.source.x + offsetY, y: d.source.y + offsetX },
                    target: { x: d.target.x + offsetY, y: d.target.y + offsetX }
                }));

            // Exit links
            link.exit()
                .transition()
                .duration(duration)
                .attr('d', d => {
                    const o = { x: source.x + offsetY, y: source.y + offsetX };
                    return diagonal({ source: o, target: o });
                })
                .remove();

            // Update nodes
            const node = container.selectAll('.tree-node')
                .data(nodes, d => d.data.name + d.depth);

            // Enter nodes
            const nodeEnter = node.enter()
                .append('g')
                .attr('class', d => {
                    let cls = 'tree-node';
                    if (d.data.type) cls += ' tree-node-' + d.data.type;
                    if (d._children) cls += ' collapsed';
                    return cls;
                })
                .attr('transform', d => `translate(${source.y0 !== undefined ? source.y0 + offsetX : source.y + offsetX}, ${source.x0 !== undefined ? source.x0 + offsetY : source.x + offsetY})`)
                .on('click', (event, d) => {
                    event.stopPropagation();
                    if (d.data.type === 'concept') {
                        showConceptPopup(d.data.concept, d.data.domainName);
                    } else if (d.data.type === 'domain') {
                        showDomainPopup(d.data.domain);
                    } else {
                        // Toggle children
                        if (d.children) {
                            d._children = d.children;
                            d.children = null;
                        } else {
                            d.children = d._children;
                            d._children = null;
                        }
                        update(d);
                    }
                });

            // Node circles
            nodeEnter.append('circle')
                .attr('r', d => {
                    if (!d.data.type) return 8; // root
                    if (d.data.type === 'domain') return 10;
                    if (d.data.type === 'group') return 7;
                    return 6;
                })
                .attr('fill', d => {
                    if (!d.data.type) return '#64748b'; // root
                    if (d.data.type === 'domain') return getDomainColor(d.data.id);
                    if (d.data.type === 'group') return getDomainColor(d.data.domainId, 0.6);
                    return getColor(d.data.priority);
                })
                .attr('stroke', d => {
                    if (!d.data.type) return '#475569';
                    if (d.data.type === 'domain') return '#fff';
                    if (d.data.type === 'group') return getDomainColor(d.data.domainId);
                    return '#555';
                })
                .attr('stroke-width', d => {
                    if (d.data.type === 'domain') return stroke.domain;
                    if (d.data.type === 'group') return stroke.group;
                    return stroke.concept;
                });

            // Expand/collapse indicator
            nodeEnter.filter(d => d.data.type !== 'concept')
                .append('text')
                .attr('class', 'expand-indicator')
                .attr('x', 0)
                .attr('y', 0)
                .attr('dy', '0.35em')
                .attr('text-anchor', 'middle')
                .attr('fill', d => d.data.type === 'domain' ? '#fff' : (isLightMode ? '#333' : '#e2e8f0'))
                .attr('font-size', fontSizes.treeExpand)
                .attr('font-weight', 'bold')
                .attr('pointer-events', 'none')
                .text(d => d._children ? '+' : (d.children ? '−' : ''));

            // Node labels
            nodeEnter.append('text')
                .attr('dy', '0.35em')
                .attr('x', d => {
                    if (!d.data.type) return 14;
                    if (d.data.type === 'domain') return 16;
                    if (d.data.type === 'group') return 12;
                    return 10;
                })
                .attr('text-anchor', 'start')
                .attr('font-size', d => {
                    if (!d.data.type) return fontSizes.treeRoot;
                    if (d.data.type === 'domain') return fontSizes.treeDomain;
                    if (d.data.type === 'group') return fontSizes.treeGroup;
                    return fontSizes.treeConcept;
                })
                .attr('font-weight', d => {
                    if (!d.data.type || d.data.type === 'domain') return '600';
                    return '500';
                })
                .text(d => {
                    const name = d.data.name;
                    const maxLen = d.data.type === 'concept' ? 30 : 25;
                    return name.length > maxLen ? name.substring(0, maxLen - 2) + '..' : name;
                });

            // Merge and transition nodes
            const nodeUpdate = node.merge(nodeEnter);

            nodeUpdate
                .transition()
                .duration(duration)
                .attr('transform', d => `translate(${d.y + offsetX}, ${d.x + offsetY})`)
                .attr('class', d => {
                    let cls = 'tree-node';
                    if (d.data.type) cls += ' tree-node-' + d.data.type;
                    if (d._children) cls += ' collapsed';
                    return cls;
                });

            // Update expand indicators
            nodeUpdate.select('.expand-indicator')
                .text(d => d._children ? '+' : (d.children ? '−' : ''));

            // Exit nodes
            const nodeExit = node.exit()
                .transition()
                .duration(duration)
                .attr('transform', d => `translate(${source.y + offsetX}, ${source.x + offsetY})`)
                .remove();

            nodeExit.select('circle').attr('r', 0);
            nodeExit.select('text').style('fill-opacity', 0);

            // Store positions for transition
            nodes.forEach(d => {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        }

        // Initial render
        treeRoot.x0 = height / 2;
        treeRoot.y0 = 0;
        update(treeRoot);

        // Reset zoom to identity (tree is already centered via offsetX/offsetY)
        treeSvg.call(treeZoom.transform, d3.zoomIdentity);
    }

    function renderTable() {
        const tbody = document.getElementById('tableBody');
        // Don't skip re-render when filtering
        const renderData = getRenderData();

        let html = '';

        renderData.domains.forEach(domain => {
            if (!domain.groups || domain.groups.length === 0) {
                html += `<tr>
                    <td class="domain-cell" style="color: ${getDomainColor(domain.id)}">${domain.name}</td>
                    <td class="group-cell">-</td>
                    <td>-</td>
                    <td class="priority-cell"><span class="priority-badge" style="background: #e9ecef; color: #666;">-</span></td>
                    <td class="description-cell">Keine Konzepte definiert</td>
                    <td class="standards-cell">-</td>
                </tr>`;
                return;
            }

            domain.groups.forEach((group, gi) => {
                if (!group.concepts || group.concepts.length === 0) return;

                group.concepts.forEach((concept, ci) => {
                    const priorityColor = getColor(concept.priority);
                    const textColor = concept.priority.toLowerCase() === 'muss' ? '#1a5f3a' :
                                     concept.priority.toLowerCase().includes('soll') ? '#7a5d00' : '#495057';

                    html += `<tr>
                        <td class="domain-cell" style="color: ${getDomainColor(domain.id)}">${gi === 0 && ci === 0 ? domain.name : ''}</td>
                        <td class="group-cell">${ci === 0 ? group.name : ''}</td>
                        <td><strong>${concept.name}</strong></td>
                        <td class="priority-cell">
                            <span class="priority-badge" style="background: ${priorityColor}; color: ${textColor};">${concept.priority}</span>
                        </td>
                        <td class="description-cell">${concept.description || '-'}</td>
                        <td class="standards-cell">${concept.standards || '-'}</td>
                    </tr>`;
                });
            });
        });

        tbody.innerHTML = html;
    }

    // Zoom controls
    window.zoomIn = function() {
        const chartVisible = document.getElementById('chart').style.display !== 'none';
        const treeVisible = document.getElementById('treeView').style.display !== 'none';
        if (chartVisible) {
            svg.transition().duration(300).call(zoom.scaleBy, 1.4);
        } else if (treeVisible && treeSvg && treeZoom) {
            treeSvg.transition().duration(300).call(treeZoom.scaleBy, 1.4);
        } else if (graphSvg && graphZoom) {
            graphSvg.transition().duration(300).call(graphZoom.scaleBy, 1.4);
        }
    };

    window.zoomOut = function() {
        const chartVisible = document.getElementById('chart').style.display !== 'none';
        const treeVisible = document.getElementById('treeView').style.display !== 'none';
        if (chartVisible) {
            svg.transition().duration(300).call(zoom.scaleBy, 0.7);
        } else if (treeVisible && treeSvg && treeZoom) {
            treeSvg.transition().duration(300).call(treeZoom.scaleBy, 0.7);
        } else if (graphSvg && graphZoom) {
            graphSvg.transition().duration(300).call(graphZoom.scaleBy, 0.7);
        }
    };

    window.zoomReset = function() {
        const chartVisible = document.getElementById('chart').style.display !== 'none';
        const treeVisible = document.getElementById('treeView').style.display !== 'none';
        if (chartVisible) {
            svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
        } else if (treeVisible && treeSvg && treeZoom) {
            treeSvg.transition().duration(300).call(treeZoom.transform, d3.zoomIdentity.translate(50, 0));
        } else if (graphSvg && graphZoom) {
            graphSvg.transition().duration(300).call(graphZoom.transform, d3.zoomIdentity);
        }
    };

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePopup();
        if (e.key === '+' || e.key === '=') zoomIn();
        if (e.key === '-') zoomOut();
        if (e.key === '0') zoomReset();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
