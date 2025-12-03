import { ALL_PARTNERS } from './data';
import type { AppState } from './types';

export const $ = (sel: string): HTMLElement | null => document.querySelector(sel);
export const $$ = (sel: string) => Array.from(document.querySelectorAll(sel));

export function renderActiveThisWeek(state: AppState, onRemove: (name: string) => void) {
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
        btn.onclick = () => onRemove(name);
        chipContainer?.appendChild(btn);
    });
}

export function renderSpotlights(state: AppState, onRemove: (name: string) => void) {
    const div = $('#active-spotlights');
    if (!div) return;
    div.innerHTML = '';
    
    state.spotlights.forEach(name => {
        const partner = ALL_PARTNERS.find(p => p.name === name);
        const tag = document.createElement('span');
        tag.className = 'active-potm-tag';
        tag.innerHTML = `${partner ? partner.short : name} <span class="remove">x</span>`;
        tag.querySelector('.remove')?.addEventListener('click', () => onRemove(name));
        div.appendChild(tag);
    });
}

export function renderResults(state: AppState) {
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
}

export function renderDealList(state: AppState, onRemove: (id: string) => void) {
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
            if (id) onRemove(id);
        });
    });
}

export function renderSupplierChips(state: AppState, onFilter: (name: string | null) => void) {
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

    createChip('All', !state.supplierFilter, () => onFilter(null));

    suppliers.forEach(name => {
        createChip(name, state.supplierFilter === name, () => onFilter(name));
    });
}

export function renderLastWeekSelector(state: AppState, onToggle: (name: string) => void) {
    const lastWeekDiv = $('#lastweek-chips');
    const lastWeekCount = $('#lastweek-count');
    if (!lastWeekDiv) return;

    lastWeekDiv.innerHTML = '';
    ALL_PARTNERS.forEach(p => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `chip ${state.lastWeekPartners.includes(p.name) ? 'active' : ''}`;
        btn.textContent = p.short;
        btn.onclick = () => onToggle(p.name);
        lastWeekDiv.appendChild(btn);
    });

    if (lastWeekCount) {
        lastWeekCount.textContent = String(state.lastWeekPartners.length);
    }
}