export function getFlashSaleState(product) {
  if (!product) {
    return {
      currentPrice: 0,
      flashPrice: null,
      isFlashActive: false,
      isFlashSoldOut: false,
    };
  }

  const currentPrice = Number(product.price) || 0;
  const flashPriceRaw =
    product.flash_price != null && product.flash_price !== ''
      ? Number(product.flash_price)
      : null;

  let flashPrice = null;
  let isFlashActive = false;
  let isFlashSoldOut = false;

  if (flashPriceRaw != null && !Number.isNaN(flashPriceRaw) && flashPriceRaw > 0) {
    try {
      const now = new Date();
      const start = product.flash_start_at ? new Date(product.flash_start_at) : null;
      const end = product.flash_end_at ? new Date(product.flash_end_at) : null;
      const hasQty = product.flash_quantity != null;
      const sold = Number(product.flash_sold) || 0;
      const qtyOk = !hasQty || sold < product.flash_quantity;

      if (start && end && start <= now && end > now) {
        if (qtyOk) {
          isFlashActive = true;
          flashPrice = flashPriceRaw;
        } else if (product.flash_quantity != null) {
          isFlashSoldOut = true;
        }
      }
    } catch (e) {
      // ignore date parse errors and fall back to non-flash state
    }
  }

  return {
    currentPrice,
    flashPrice,
    isFlashActive,
    isFlashSoldOut,
  };
}
