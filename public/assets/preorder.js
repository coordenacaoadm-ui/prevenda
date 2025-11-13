
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.js-preorder');
  if (!btn) return;
  e.preventDefault();
  const variant = btn.dataset.variant;
  const eta = btn.dataset.eta || '7 dias';
  const qty = Number(btn.dataset.qty || 1);

  try {
    await fetch('/cart/add.js', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        id: variant,
        quantity: qty,
        properties: { type: 'preorder', eta }
      })
    });
    window.location.href = '/cart';
  } catch (err) {
    console.error('preorder add error', err);
    alert('Não foi possível adicionar o item. Tente novamente.');
  }
});
