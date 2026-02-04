-- Overload functions to support bulk deduction

-- 1. Deduct Product Stock (Quantity support)
CREATE OR REPLACE FUNCTION deduct_product_stock(target_product_id BIGINT, deduct_amount INTEGER)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  current_stock INTEGER;
  product_record RECORD;
BEGIN
  -- Validate amount
  IF deduct_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid quantity');
  END IF;

  -- Lock the row
  SELECT quantity INTO current_stock
  FROM products
  WHERE id = target_product_id
  FOR UPDATE;

  -- Check existence
  IF current_stock IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;

  -- Check availability
  IF current_stock < deduct_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient stock',
      'current_stock', current_stock,
      'requested', deduct_amount
    );
  END IF;

  -- Deduct
  UPDATE products
  SET quantity = quantity - deduct_amount
  WHERE id = target_product_id;

  -- Get updated stock
  SELECT quantity INTO current_stock
  FROM products
  WHERE id = target_product_id;

  -- Get info
  SELECT id, name INTO product_record
  FROM products
  WHERE id = target_product_id;

  RETURN jsonb_build_object(
    'success', true,
    'previous_stock', current_stock + deduct_amount,
    'current_stock', current_stock,
    'product_id', product_record.id,
    'product_name', product_record.name,
    'deducted', deduct_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Deduct Variant Stock (Quantity support)
CREATE OR REPLACE FUNCTION deduct_stock(target_variant_id BIGINT, deduct_amount INTEGER)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  current_stock INTEGER;
  product_record RECORD;
BEGIN
  IF deduct_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid quantity');
  END IF;

  SELECT stock_quantity INTO current_stock
  FROM variants
  WHERE id = target_variant_id
  FOR UPDATE;

  IF current_stock IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Variant not found');
  END IF;

  IF current_stock < deduct_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient stock',
      'current_stock', current_stock,
      'requested', deduct_amount
    );
  END IF;

  UPDATE variants
  SET stock_quantity = stock_quantity - deduct_amount, updated_at = NOW()
  WHERE id = target_variant_id;

  SELECT stock_quantity INTO current_stock
  FROM variants
  WHERE id = target_variant_id;

  SELECT p.id, p.name, v.size
  INTO product_record
  FROM variants v
  JOIN products p ON p.id = v.product_id
  WHERE v.id = target_variant_id;

  RETURN jsonb_build_object(
    'success', true,
    'previous_stock', current_stock + deduct_amount,
    'current_stock', current_stock,
    'product_id', product_record.id,
    'product_name', product_record.name,
    'size', product_record.size,
    'deducted', deduct_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Default trust points function update? currently it just takes points.
-- We'll just call it once or multiply points.
