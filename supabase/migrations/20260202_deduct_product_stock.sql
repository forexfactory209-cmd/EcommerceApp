-- Create function to deduct stock directly from products table (for products without variants)
CREATE OR REPLACE FUNCTION deduct_product_stock(target_product_id BIGINT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  current_stock INTEGER;
  product_record RECORD;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT quantity INTO current_stock
  FROM products
  WHERE id = target_product_id
  FOR UPDATE;

  -- Check if product exists
  IF current_stock IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Product not found'
    );
  END IF;

  -- Check if stock is available
  IF current_stock <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Out of stock',
      'current_stock', current_stock
    );
  END IF;

  -- Deduct stock
  UPDATE products
  SET 
    quantity = quantity - 1
  WHERE id = target_product_id;

  -- Get updated stock
  SELECT quantity INTO current_stock
  FROM products
  WHERE id = target_product_id;

  -- Get product info
  SELECT id, name
  INTO product_record
  FROM products
  WHERE id = target_product_id;

  RETURN jsonb_build_object(
    'success', true,
    'previous_stock', current_stock + 1,
    'current_stock', current_stock,
    'product_id', product_record.id,
    'product_name', product_record.name,
    'size', null
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION deduct_product_stock IS 'Deduct stock directly from products table for items without variants';
