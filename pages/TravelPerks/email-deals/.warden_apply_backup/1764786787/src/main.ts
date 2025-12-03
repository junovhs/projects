import { ALL_PARTNERS } from './data';
import { AppState, Deal } from './types';
import { computeLineup, parseDeals, sortDeals } from './logic';

const $ = (sel: string): HTMLElement | null => document.querySelector(sel);
const $$ = (sel: string) => Array.from(document.querySelectorAll(sel));

const state: AppState = {
    popularPotm: '',
    luxuryPotm: '',
    spotlights: [],
    activeThisWeek: [],
    lastWeekPartners: [],
    computedLineup: [],
    deals: [],
    filteredDeals: [],
    selectedDeals: [],
    supplierFilter: null,
    filterByRotator: false,
    filterExclusive: false
};

function renderActiveThisWeek() {
    const container = $('#active-this-week-container');
    if (!container) return;

    if (state.activeThisWeek.length === 0) {
        container.innerHTML = '<p class="help-text">Select your POTMs above first</p>';
        return;
    }

    container.innerHTML = '<div class="chip-container"></div><p class="help-text" style="margin-top: 0.5rem;">Click partners that are active THIS week</p>';
    const chipContainer = container.querySelector('.chip-container');
    
    state.activeThisWeek.forEach(name => {
        const partner = ALL_PARTNERS.find(p => p.name === name);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'chip active';
        btn.textContent = partner ? partner.short : name;
        btn.onclick = () => {
            state.activeThisWeek = state.activeThisWeek.filter(n => n !== name);
            renderActiveThisWeek();
            saveState();
        };
        chipContainer?.appendChild(btn);
    });
}

function renderSpotlights() {
    const div = $('#active-spotlights');
    if (!div) return;
    div.innerHTML = '';
    
    state.spotlights.forEach(name => {
        const partner = ALL_PARTNERS.find(p => p.name === name);
        const tag = document.createElement('span');
        tag.className = 'active-potm-tag';
        tag.innerHTML = `${partner ? partner.short : name} <span class="remove">x</span>`;
        tag.querySelector('.remove')?.addEventListener('click', () => {
            state.spotlights = state.spotlights.filter(s => s !== name);
            state.activeThisWeek = state.activeThisWeek.filter(s => s !== name);
            renderSpotlights();
            renderActiveThisWeek();
            saveState();
        });
        div.appendChild(tag);
    });
}

function renderResults() {
    const container = $('#results-container');
    const copySection = $('#copy-section');
    if (!container || !copySection) return;

    if (state.computedLineup.length === 0) {
        container.innerHTML = '<div class="results-empty">Complete steps above and click compute</div>';
        copySection.style.display = 'none';
        return;
    }

    const html = state.computedLineup.map(name => {
        const partner = ALL_PARTNERS.find(p => p.name === name);
        const displayName = partner ? partner.short : name;
        let badge = '<span class="result-badge badge-priority">Priority Fill</span>';
        
        if (name === state.popularPotm) badge = '<span class="result-badge badge-potm">Popular POTM</span>';
        else if (name === state.luxuryPotm) badge = '<span class="result-badge badge-potm">Luxury POTM</span>';
        else if (state.spotlights.includes(name)) badge = '<span class="result-badge badge-spotlight">Spotlight</span>';
        
        return `<li>${badge}<span class="result-name">${displayName}</span></li>`;
    }).join('');

    container.innerHTML = `<ul class="results-list">${html}</ul>`;
    copySection.style.display = 'flex';
    
    if (state.deals.length > 0) filterAndRenderDeals();
}

function renderDealList() {
    const list = $('#deal-list');
    const countSpan = $('#deal-count');
    if (!list || !countSpan) return;

    countSpan.textContent = String(state.selectedDeals.length);
    if (state.selectedDeals.length === 0) {
        list.innerHTML = '<li class="placeholder">No deals match your filters</li>';
        return;
    }

    list.innerHTML = state.selectedDeals.map(d => `
        <li class="deal-item" data-id="${d.id}">
            <span class="deal-star">${d.exclusive ? '?' : ''}</span>
            <span class="deal-supplier">${d.displayName}</span>
            <button class="deal-remove" title="Remove">&times;</button>
            <div class="deal-title-row">
                <span class="deal-title">${d.title}</span>
                ${d.formattedExpiry ? `<span class="deal-expiry">${d.formattedExpiry}</span>` : ''}
            </div>
            <div class="deal-description">${d.description}</div>
        </li>
    `).join('');

    $$('.deal-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = (e.target as HTMLElement).closest('.deal-item')?.getAttribute('data-id');
            if (id) {
                state.selectedDeals = state.selectedDeals.filter(d => d.id !== id);
                renderDealList();
            }
        });
    });
}

function renderSupplierChips() {
    const chipsDiv = $('#supplier-chips');
    if (!chipsDiv) return;
    
    const suppliers = Array.from(new Set(state.deals.map(d => d.displayName))).sort();
    chipsDiv.innerHTML = '';
    
    const createChip = (text: string, isActive: boolean, onClick: () => void) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `chip ${isActive ? 'active' : ''}`;
        btn.textContent = text;
        btn.onclick = onClick;
        chipsDiv.appendChild(btn);
    };

    createChip('All', !state.supplierFilter, () => {
        state.supplierFilter = null;
        filterAndRenderDeals();
        renderSupplierChips();
    });

    suppliers.forEach(name => {
        createChip(name, state.supplierFilter === name, () => {
            state.supplierFilter = name;
            filterAndRenderDeals();
            renderSupplierChips();
        });
    });
}

function filterAndRenderDeals() {
    let filtered = [...state.deals];
    
    if (state.filterByRotator && state.computedLineup.length > 0) {
        filtered = filtered.filter(d => state.computedLineup.includes(d.displayName));
    }
    if (state.supplierFilter) {
        filtered = filtered.filter(d => d.displayName === state.supplierFilter);
    }
    if (state.filterExclusive) {
        filtered = filtered.filter(d => d.exclusive);
    }

    state.filteredDeals = filtered;
    state.selectedDeals = sortDeals(filtered);
    renderDealList();
}

function saveState() {
    try {
        localStorage.setItem('hotdeals_state', JSON.stringify({
            popularPotm: state.popularPotm,
            luxuryPotm: state.luxuryPotm,
            spotlights: state.spotlights,
            activeThisWeek: state.activeThisWeek,
            lastWeekPartners: state.lastWeekPartners,
            computedLineup: state.computedLineup
        }));
    } catch (e) {
        console.error('Save failed', e);
    }
}

function loadState() {
    try {
        const saved = localStorage.getItem('hotdeals_state');
        if (!saved) return;
        const data = JSON.parse(saved);

        state.popularPotm = data.popularPotm || '';
        state.luxuryPotm = data.luxuryPotm || '';
        state.spotlights = data.spotlights || [];
        state.activeThisWeek = data.activeThisWeek || [];
        state.lastWeekPartners = data.lastWeekPartners || [];
        state.computedLineup = data.computedLineup || [];

        const popSelect = $('#popular-potm') as HTMLSelectElement;
        const luxSelect = $('#luxury-potm') as HTMLSelectElement;
        if (popSelect) popSelect.value = state.popularPotm;
        if (luxSelect) luxSelect.value = state.luxuryPotm;

        renderSpotlights();
        renderActiveThisWeek();
        renderResults();
        
        const lastWeekDiv = $('#lastweek-chips');
        const lastWeekCount = $('#lastweek-count');
        if (lastWeekDiv) {
            lastWeekDiv.innerHTML = '';
            ALL_PARTNERS.forEach(p => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `chip ${state.lastWeekPartners.includes(p.name) ? 'active' : ''}`;
                btn.textContent = p.short;
                btn.onclick = () => {
                    if (state.lastWeekPartners.includes(p.name)) {
                        state.lastWeekPartners = state.lastWeekPartners.filter(n => n !== p.name);
                        btn.classList.remove('active');
                    } else if (state.lastWeekPartners.length < 4) {
                        state.lastWeekPartners.push(p.name);
                        btn.classList.add('active');
                    }
                    if (lastWeekCount) lastWeekCount.textContent = String(state.lastWeekPartners.length);
                    saveState();
                };
                lastWeekDiv.appendChild(btn);
            });
            if (lastWeekCount) lastWeekCount.textContent = String(state.lastWeekPartners.length);
        }

    } catch (e) {
        console.error('Load failed', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const popSelect = $('#popular-potm') as HTMLSelectElement;
    const luxSelect = $('#luxury-potm') as HTMLSelectElement;
    const spotSelect = $('#spotlight-select') as HTMLSelectElement;

    ALL_PARTNERS.filter(p => p.category === 'popular').forEach(p => popSelect?.add(new Option(p.short, p.name)));
    ALL_PARTNERS.filter(p => ['luxury', 'expedition'].includes(p.category)).forEach(p => luxSelect?.add(new Option(p.short, p.name)));
    ALL_PARTNERS.forEach(p => spotSelect?.add(new Option(p.short, p.name)));

    popSelect?.addEventListener('change', () => {
        state.popularPotm = popSelect.value;
        if (state.popularPotm && !state.activeThisWeek.includes(state.popularPotm)) {
            state.activeThisWeek.push(state.popularPotm);
        }
        renderActiveThisWeek();
        saveState();
    });

    luxSelect?.addEventListener('change', () => {
        state.luxuryPotm = luxSelect.value;
        if (state.luxuryPotm && !state.activeThisWeek.includes(state.luxuryPotm)) {
            state.activeThisWeek.push(state.luxuryPotm);
        }
        renderActiveThisWeek();
        saveState();
    });

    spotSelect?.addEventListener('change', () => {
        const val = spotSelect.value;
        if (val && !state.spotlights.includes(val)) {
            state.spotlights.push(val);
            state.activeThisWeek.push(val);
            renderSpotlights();
            renderActiveThisWeek();
            saveState();
        }
        spotSelect.value = '';
    });

    $('#compute-btn')?.addEventListener('click', () => {
        if (state.activeThisWeek.length === 0) {
            alert('Please select at least one POTM or Spotlight as active this week');
            return;
        }
        state.computedLineup = computeLineup(state);
        renderResults();
        saveState();
    });

    $('#copy-names-btn')?.addEventListener('click', async (e) => {
        const btn = e.target as HTMLElement;
        await navigator.clipboard.writeText(state.computedLineup.join('\n'));
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = original, 1500);
    });

    $('#json-file')?.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const uploadArea = $('#upload-area');
        const uploadText = uploadArea?.querySelector('.upload-text');
        if (uploadText) uploadText.innerHTML = `<span class="file-name">${file.name}</span>`;
        uploadArea?.classList.add('has-file');

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const json = JSON.parse(evt.target?.result as string);
                state.deals = parseDeals(json);
                state.filteredDeals = [...state.deals];
                state.selectedDeals = [...state.deals];

                $('#deal-filters')!.style.display = 'block';
                $('#deal-list-container')!.style.display = 'block';
                
                renderSupplierChips();
                filterAndRenderDeals();
            } catch (err) {
                alert('Invalid JSON');
            }
        };
        reader.readAsText(file);
    });

    $('#filter-rotator')?.addEventListener('change', (e) => {
        state.filterByRotator = (e.target as HTMLInputElement).checked;
        filterAndRenderDeals();
    });

    $('#filter-exclusive')?.addEventListener('change', (e) => {
        state.filterExclusive = (e.target as HTMLInputElement).checked;
        filterAndRenderDeals();
    });

    $('#copy-deals-btn')?.addEventListener('click', async (e) => {
        if (state.selectedDeals.length === 0) return;
        const btn = e.target as HTMLElement;
        const text = state.selectedDeals.map(d => `${d.displayName}\n${d.exclusive ? 'EXCLUSIVE: ' : ''}${d.title}`).join('\n\n');
        await navigator.clipboard.writeText(text);
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = original, 1500);
    });

    loadState();
});