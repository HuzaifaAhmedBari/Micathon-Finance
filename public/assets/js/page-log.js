document.addEventListener('DOMContentLoaded', async () => {
  // Wait for async store to initialize
  await HP.init();

  // ── State ──────────────────────────────────────────────────────
  let rawValue = '';
  let currentType = 'sale';   // 'sale' | 'expense'
  let selectedItem = null;    // { id, name, category, type, inventoryItemId?, unit? }

  // ── Date ───────────────────────────────────────────────────────
  const dateInput = document.getElementById('entryDate');
  dateInput.value = new Date().toISOString().split('T')[0];

  // ── Numpad ─────────────────────────────────────────────────────
  function updateDisplay() {
    const num = rawValue === '' ? 0 : parseFloat(rawValue);
    document.getElementById('amountDisplay').textContent =
      'PKR ' + (isNaN(num) ? '0' : num.toLocaleString('en-PK'));
  }

  function handleNumpad(val) {
    if (val === 'back') { rawValue = rawValue.slice(0, -1); }
    else if (val === '.') { if (!rawValue.includes('.')) rawValue += '.'; }
    else {
      if (rawValue.length >= 9) return;
      if (rawValue === '0') rawValue = val; else rawValue += val;
    }
    updateDisplay();
  }

  document.querySelectorAll('.numpad-key').forEach(btn =>
    btn.addEventListener('click', () => handleNumpad(btn.dataset.val))
  );

  // Keyboard
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    let val = null;
    if (e.key >= '0' && e.key <= '9') val = e.key;
    else if (e.key === '.') val = '.';
    else if (e.key === 'Backspace') val = 'back';
    else if (e.key === 'Enter') { document.getElementById('submitBtn')?.click(); return; }
    if (val !== null) {
      e.preventDefault(); handleNumpad(val);
      const key = document.querySelector(`.numpad-key[data-val="${val}"]`);
      if (key) { key.classList.add('key-pressed'); setTimeout(() => key.classList.remove('key-pressed'), 120); }
    }
  });

  // ── Category Chips ─────────────────────────────────────────────
  function setCategory(cat) {
    document.querySelectorAll('.filter-chip[data-group="cat"]').forEach(c => {
      c.classList.toggle('active', c.textContent === cat);
    });
  }

  document.querySelectorAll('.filter-chip[data-group="cat"]').forEach(chip => {
    chip.addEventListener('click', async () => {
      setCategory(chip.textContent);
      await buildPickerList(pickerSearch.value);
    });
  });

  // ── Type Toggle ────────────────────────────────────────────────
  async function setType(type) {
    currentType = type;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active-emerald', 'active-coral'));
    const btn = document.querySelector(`.toggle-btn[data-type="${type}"]`);
    if(btn) btn.classList.add(type === 'expense' ? 'active-coral' : 'active-emerald');
    const amountEl = document.getElementById('amountDisplay');
    amountEl.className = 'amount-value ' + (type === 'expense' ? 'coral' : 'emerald');
    const submitBtn = document.getElementById('submitBtn');
    if (type === 'expense') {
      submitBtn.textContent = 'Save Kharcha (Expense)';
      submitBtn.className = 'btn btn-pill-lg btn-danger';
    } else {
      submitBtn.textContent = 'Save Bikri (Sale)';
      submitBtn.className = 'btn btn-pill-lg btn-primary';
    }
    
    // Hide Utilities and Misc when on Sale
    document.querySelectorAll('.filter-chip[data-group="cat"]').forEach(c => {
      if (c.textContent === 'Utilities' || c.textContent === 'Misc') {
        c.style.display = type === 'sale' ? 'none' : 'inline-flex';
      }
    });
    setCategory('All');
    
    resetPicker();
    await buildPickerList('');
  }

  document.querySelectorAll('.toggle-btn').forEach(btn =>
    btn.addEventListener('click', async () => await setType(btn.dataset.type))
  );

  // ── Item Picker ────────────────────────────────────────────────
  const trigger   = document.getElementById('pickerTrigger');
  const dropdown  = document.getElementById('pickerDropdown');
  const pickerLabel   = document.getElementById('pickerLabel');
  const pickerSearch  = document.getElementById('pickerSearch');
  const pickerList    = document.getElementById('pickerList');
  const qtyRow        = document.getElementById('qtyRow');
  const qtyInput      = document.getElementById('qtyInput');
  const qtyUnitInput  = document.getElementById('qtyUnitInput');

  async function buildPickerList(query) {
    pickerList.innerHTML = '';
    const q = query.toLowerCase().trim();
    const activeChip = document.querySelector('.filter-chip[data-group="cat"].active')?.textContent || 'All';
    const inventory = await HP.getInventory();

    if (currentType === 'sale') {
      if (activeChip === 'All' || activeChip === 'Stock') {
        const filteredInv = q ? inventory.filter(i => i.name.toLowerCase().includes(q)) : inventory;
        if (filteredInv.length) {
          addSection('Sell Inventory Item');
          filteredInv.forEach(i => addPickerItem({
            id: 'inv_sale_' + i.id, name: i.name, category: i.category,
            type: 'sale', badge: 'sale', inventoryItemId: i.id, unit: i.unit
          }));
        }
      }
    } else {
      const presets = HP.UTILITY_PRESETS;
      const filteredPresets = q ? presets.filter(p => p.name.toLowerCase().includes(q)) : presets;
      
      if (activeChip === 'All' || activeChip === 'Utilities') {
        const utils = filteredPresets.filter(p => p.category === 'Utilities' || p.category === 'Rent' || p.category === 'Transport');
        if (utils.length) {
          addSection('Utilities & Fixed Expenses');
          utils.forEach(p => addPickerItem({
             id: 'preset_' + p.id, name: p.name, category: p.category, type: 'expense', badge: 'expense', inventoryItemId: null
          }));
        }
      }
      
      if (activeChip === 'All' || activeChip === 'Misc') {
        const misc = filteredPresets.filter(p => p.category === 'Misc');
        if (misc.length) {
          addSection('Misc (Auto-adds to Inventory)');
          misc.forEach(p => addPickerItem({
            id: 'preset_' + p.id, name: p.name, category: 'Misc', type: 'expense', badge: 'expense', inventoryItemId: null
          }));
        }
      }

      if (activeChip === 'All' || activeChip === 'Stock') {
        const filteredInv = q ? inventory.filter(i => i.name.toLowerCase().includes(q)) : inventory;
        if (filteredInv.length) {
          addSection('Inventory Restock');
          filteredInv.forEach(i => addPickerItem({
            id: 'restock_' + i.id, name: i.name + ' (Restock)', category: 'Stock', type: 'expense', badge: 'restock', inventoryItemId: i.id, unit: i.unit
          }));
        }
      }
    }

    addSection('Not finding what you need?');
    const addNewEl = document.createElement('div');
    addNewEl.className = 'picker-item';
    addNewEl.innerHTML = `<span class="picker-item-name" style="color:var(--emerald);font-weight:600">➕ Add New Inventory Item...</span>`;
    addNewEl.addEventListener('click', () => { window.location.href = 'inventory.html'; });
    pickerList.appendChild(addNewEl);
  }

  function addSection(label) {
    const el = document.createElement('div');
    el.className = 'picker-section-label';
    el.textContent = label;
    pickerList.appendChild(el);
  }

  function addPickerItem(item) {
    const el = document.createElement('div');
    el.className = 'picker-item';
    if (selectedItem && selectedItem.id === item.id) el.classList.add('selected');
    el.innerHTML = `
      <span class="picker-item-name">${item.name}</span>
      <span class="picker-item-badge ${item.badge}">${item.badge === 'restock' ? 'Restock' : item.type === 'sale' ? 'Sale' : 'Expense'}</span>
    `;
    el.addEventListener('click', () => selectItem(item));
    pickerList.appendChild(el);
  }

  function selectItem(item) {
    selectedItem = item;
    pickerLabel.textContent = item.name;
    pickerLabel.classList.remove('placeholder');
    closePicker();

    setCategory(item.category);
    if (!document.querySelector('.filter-chip[data-group="cat"].active')) {
      setCategory('All');
    }

    if (item.badge === 'restock' || item.badge === 'sale') {
      qtyRow.classList.add('visible');
      document.getElementById('qtyInputLabel').textContent = item.badge === 'sale' ? 'Quantity Sold' : 'Quantity Restocked';
      qtyUnitInput.value = item.unit || '';
    } else {
      qtyRow.classList.remove('visible');
    }
  }

  function resetPicker() {
    selectedItem = null;
    pickerLabel.textContent = 'Select an item or utility...';
    pickerLabel.classList.add('placeholder');
    qtyRow.classList.remove('visible');
  }

  async function openPicker() {
    trigger.classList.add('open');
    dropdown.classList.add('open');
    pickerSearch.value = '';
    await buildPickerList('');
    setTimeout(() => pickerSearch.focus(), 50);
  }

  function closePicker() {
    trigger.classList.remove('open');
    dropdown.classList.remove('open');
  }

  trigger.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (dropdown.classList.contains('open')) {
      closePicker();
    } else {
      await openPicker();
    }
  });
  trigger.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); await openPicker(); }
  });

  pickerSearch.addEventListener('input', async () => await buildPickerList(pickerSearch.value));
  pickerSearch.addEventListener('keydown', e => e.stopPropagation());

  document.addEventListener('click', (e) => {
    if (!document.getElementById('pickerWrapper').contains(e.target)) closePicker();
  });

  // Init state and picker
  await setType('sale');

  // ── Submit ─────────────────────────────────────────────────────
  document.getElementById('submitBtn').addEventListener('click', async () => {
    const amount = parseFloat(rawValue);
    if (!amount || amount <= 0) { showToast('Please enter an amount', 'error'); return; }
    if (!selectedItem) { showToast('Please select an item', 'error'); return; }

    const activeCatNode = document.querySelector('.filter-chip[data-group="cat"].active')?.textContent;
    const activeCategory = (activeCatNode && activeCatNode !== 'All') ? activeCatNode : selectedItem.category;
    
    const notesVal = document.getElementById('notes').value.trim();
    const qty = parseFloat(qtyInput.value) || 0;

    const txn = {
      date: dateInput.value,
      description: selectedItem.name.replace(' (Restock)', ''),
      category: activeCategory,
      type: currentType,
      amount,
      notes: notesVal || (qty > 0 ? (currentType === 'sale' ? `-${qty} ${qtyUnitInput.value}` : `+${qty} ${qtyUnitInput.value}`) : ''),
      inventoryItemId: selectedItem.inventoryItemId || null,
      inventoryQtyChange: (['restock', 'sale'].includes(selectedItem.badge) && qty > 0) ? qty : null,
      isUtility: selectedItem.badge === 'expense' && !selectedItem.inventoryItemId,
    };

    await HP.addTransaction(txn);
    showToast(`✓ ${txn.description} saved!`, 'success');

    rawValue = '';
    updateDisplay();
    resetPicker();
    await buildPickerList('');
    qtyInput.value = '';
    document.getElementById('notes').value = '';
    dateInput.value = new Date().toISOString().split('T')[0];
    setCategory('All');

    setTimeout(() => { window.location.href = 'transactions.html'; }, 1200);
  });

  // ── Toast ──────────────────────────────────────────────────────
  function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast');
    const icon  = document.getElementById('toastIcon');
    document.getElementById('toastMsg').textContent = msg;
    toast.className = 'show ' + type;
    if (type === 'error') {
      icon.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>';
    } else {
      icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>';
    }
    setTimeout(() => { toast.className = type; }, 2800);
  }
});
