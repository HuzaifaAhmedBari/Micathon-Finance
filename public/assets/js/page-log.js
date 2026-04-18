document.addEventListener('DOMContentLoaded', async () => {
  // Wait for async store to initialize
  try {
    await HP.init();
  } catch (err) {
    console.error("Init failed:", err);
  }

  // ── State ──────────────────────────────────────────────────────
  let currentType = 'sale';   // 'sale' | 'expense'
  let selectedItem = null;    // { id, name, category, type, inventoryItemId?, unit? }

  // ── Date ───────────────────────────────────────────────────────
  const dateInput = document.getElementById('entryDate');
  dateInput.value = new Date().toISOString().split('T')[0];

  const amountInput = document.getElementById('amountInput');

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
    
    // Switch input highlighting color
    amountInput.style.color = type === 'expense' ? 'var(--coral)' : 'var(--emerald)';
    
    const submitBtn = document.getElementById('submitBtn');
    if (type === 'expense') {
      submitBtn.textContent = 'Save Kharcha (Expense)';
      submitBtn.className = 'btn btn-pill-lg btn-danger';
    } else {
      submitBtn.textContent = 'Save Bikri (Sale)';
      submitBtn.className = 'btn btn-pill-lg btn-primary';
    }
    
    // Hide/Show correct category chips based on their data-type
    document.querySelectorAll('.filter-chip[data-group="cat"]').forEach(c => {
      if (c.dataset.type === 'all') {
         c.style.display = 'inline-flex';
      } else {
         c.style.display = c.dataset.type === type ? 'inline-flex' : 'none';
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
  const qtyUnitDisplay = document.getElementById('qtyUnitDisplay');

  async function buildPickerList(query) {
    pickerList.innerHTML = '';
    const q = query.toLowerCase().trim();
    const activeCatNode = document.querySelector('.filter-chip[data-group="cat"].active');
    const activeChip = activeCatNode ? activeCatNode.textContent : 'All';
    const inventory = await HP.getInventory();

    if (currentType === 'sale') {
      // Show products filtered by category if applicable
      const filteredByCategory = activeChip === 'All' ? inventory : inventory.filter(i => i.category === activeChip);
      const filteredInv = q ? filteredByCategory.filter(i => i.name.toLowerCase().includes(q)) : filteredByCategory;
      
      if (filteredInv.length) {
        addSection('Sell Inventory Item');
        filteredInv.forEach(i => addPickerItem({
          id: 'inv_sale_' + i.id, name: i.name, category: i.category,
          type: 'sale', badge: 'sale', inventoryItemId: i.id, unit: i.unit
        }));
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
        const filteredByCategory = activeChip === 'Stock' ? inventory : inventory;
        const filteredInv = q ? filteredByCategory.filter(i => i.name.toLowerCase().includes(q)) : filteredByCategory;
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
    addNewEl.addEventListener('click', () => { window.location.href = 'inventory.html?action=add-item'; });
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

    const activeCatNode = document.querySelector('.filter-chip[data-group="cat"].active');
    if (activeCatNode && activeCatNode.dataset.type === 'all') {
      // Keep 'All' category active
    } else {
      setCategory(item.category);
      if (!document.querySelector('.filter-chip[data-group="cat"].active')) {
        setCategory('All');
      }
    }

    // Hide or Show quantity row based on item type
    if (item.badge === 'restock' || item.badge === 'sale') {
      qtyRow.classList.add('visible');
      document.getElementById('qtyInputLabel').textContent = item.badge === 'sale' ? 'Quantity Sold' : 'Quantity Restocked';
      qtyUnitDisplay.textContent = item.unit || 'pcs';
      qtyInput.value = '1'; // Default to 1
      
      // Auto-calculate logic
      updateCalculatedAmount();
    } else {
      qtyRow.classList.remove('visible');
      qtyInput.value = '';
      
      // Allow manual entry for Utilities/Misc; clear the existing amount
      amountInput.value = '';
      document.getElementById('amountLabel').textContent = 'Enter Amount (PKR) *';
      
      const pi = document.getElementById('priceIndicator');
      if (pi) pi.remove();
    }
  }

  async function updateCalculatedAmount() {
    if (!selectedItem || !selectedItem.inventoryItemId) return;
    
    const inventory = await HP.getInventory();
    const invItem = inventory.find(i => i.id === selectedItem.inventoryItemId);
    if (!invItem) return;

    const qty = parseFloat(qtyInput.value) || 0;
    const price = currentType === 'sale' ? (invItem.salePrice || 0) : (invItem.costPrice || 0);
    const total = qty * price;
    
    amountInput.value = total;
    
    // Add a price indicator if not already there
    let priceIndicator = document.getElementById('priceIndicator');
    if (!priceIndicator) {
        priceIndicator = document.createElement('div');
        priceIndicator.id = 'priceIndicator';
        priceIndicator.style = 'font-size: 11px; color: var(--text-muted); text-align: center; margin-top: -16px; margin-bottom: 20px;';
        document.querySelector('.amount-display').after(priceIndicator);
    }
    priceIndicator.textContent = `Unit Price: ${price.toLocaleString('en-PK')} per ${invItem.unit} × ${qty} ${invItem.unit} (You can override this below)`;
  }

  qtyInput.addEventListener('input', updateCalculatedAmount);

  function resetPicker() {
    selectedItem = null;
    pickerLabel.textContent = 'Select an item or utility...';
    pickerLabel.classList.add('placeholder');
    qtyRow.classList.remove('visible');
    amountInput.value = '';
    
    const pi = document.getElementById('priceIndicator');
    if (pi) pi.remove();
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
    const amount = parseFloat(amountInput.value);
    if ((!amount || amount <= 0) && (!selectedItem || !selectedItem.inventoryItemId)) { 
        showToast('Please enter an amount', 'error'); return; 
    }
    if (!selectedItem) { showToast('Please select an item', 'error'); return; }

    const activeCatNode = document.querySelector('.filter-chip[data-group="cat"].active')?.textContent;
    const activeCategory = (activeCatNode && activeCatNode !== 'All') ? activeCatNode : selectedItem.category;
    
    const notesVal = document.getElementById('notes').value.trim();
    const qty = parseFloat(qtyInput.value) || 0;

    // Verify Stock Availability Before Sale
    if (currentType === 'sale' && selectedItem && selectedItem.inventoryItemId) {
      const inventory = await HP.getInventory();
      const invItem = inventory.find(i => i.id === selectedItem.inventoryItemId);
      if (invItem && qty > invItem.qty) {
        showToast(`Not enough stock! Only ${invItem.qty} ${invItem.unit} remaining.`, 'error');
        return;
      }
    }

    const txn = {
      date: dateInput.value,
      description: selectedItem.name.replace(' (Restock)', ''),
      category: activeCategory,
      type: currentType,
      amount,
      unit: selectedItem.unit || 'pcs', 
      notes: notesVal || (qty > 0 ? (currentType === 'sale' ? `-${qty} ${qtyUnitDisplay.textContent}` : `+${qty} ${qtyUnitDisplay.textContent}`) : ''),
      inventoryItemId: selectedItem.inventoryItemId || null,
      inventoryQtyChange: (['restock', 'sale'].includes(selectedItem.badge) && qty > 0) ? qty : null,
      isUtility: selectedItem.badge === 'expense' && !selectedItem.inventoryItemId,
    };

    await HP.addTransaction(txn);
    showToast(`✓ ${txn.description} saved!`, 'success');

    resetPicker();
    await buildPickerList('');
    qtyInput.value = '';
    document.getElementById('notes').value = '';
    dateInput.value = new Date().toISOString().split('T')[0];
    setCategory('All');
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
