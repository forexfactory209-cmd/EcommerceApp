-- Physical Sale Sync Feature Migration
-- This migration adds support for product variants and physical sales tracking

-- 1. Create variants table for size-based inventory management
CREATE TABLE IF NOT EXISTS variants (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  sku TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, size)
);

-- 2. Create sales_history table to log physical sales
CREATE TABLE IF NOT EXISTS sales_history (
  id BIGSERIAL PRIMARY KEY,
  seller_id UUID NOT NULL,
  product_id BIGINT NOT NULL REFERENCES products(id),
  variant_id BIGINT REFERENCES variants(id),
  size TEXT,
  sale_type TEXT NOT NULL CHECK (sale_type IN ('physical', 'online')),
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_variants_product_id ON variants(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_history_seller_id ON sales_history(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_history_product_id ON sales_history(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_history_created_at ON sales_history(created_at DESC);

-- 4. Enable Row Level Security
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_history ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read access to variants" ON variants;
DROP POLICY IF EXISTS "Allow sellers to insert their own variants" ON variants;
DROP POLICY IF EXISTS "Allow sellers to update their own variants" ON variants;
DROP POLICY IF EXISTS "Allow sellers to delete their own variants" ON variants;
DROP POLICY IF EXISTS "Allow sellers to read their own sales history" ON sales_history;
DROP POLICY IF EXISTS "Allow sellers to insert their own sales" ON sales_history;

-- 6. RLS Policies for variants table
-- Allow everyone to read variants
CREATE POLICY "Allow public read access to variants"
  ON variants FOR SELECT
  USING (true);

-- Allow sellers to manage their own product variants
CREATE POLICY "Allow sellers to insert their own variants"
  ON variants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = variants.product_id
      AND products.brand_user_id = auth.uid()
    )
  );

CREATE POLICY "Allow sellers to update their own variants"
  ON variants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = variants.product_id
      AND products.brand_user_id = auth.uid()
    )
  );

CREATE POLICY "Allow sellers to delete their own variants"
  ON variants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = variants.product_id
      AND products.brand_user_id = auth.uid()
    )
  );

-- 7. RLS Policies for sales_history table
-- Allow sellers to read their own sales history
CREATE POLICY "Allow sellers to read their own sales history"
  ON sales_history FOR SELECT
  USING (seller_id = auth.uid());

-- Allow sellers to insert their own sales
CREATE POLICY "Allow sellers to insert their own sales"
  ON sales_history FOR INSERT
  WITH CHECK (seller_id = auth.uid());

-- 8. Create the stock deduction function with race condition protection
CREATE OR REPLACE FUNCTION deduct_stock(target_variant_id BIGINT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  current_stock INTEGER;
  product_record RECORD;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT stock_quantity INTO current_stock
  FROM variants
  WHERE id = target_variant_id
  FOR UPDATE;

  -- Check if variant exists
  IF current_stock IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Variant not found'
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
  UPDATE variants
  SET 
    stock_quantity = stock_quantity - 1,
    updated_at = NOW()
  WHERE id = target_variant_id;

  -- Get updated stock
  SELECT stock_quantity INTO current_stock
  FROM variants
  WHERE id = target_variant_id;

  -- Get product info for the result
  SELECT p.id, p.name, v.size
  INTO product_record
  FROM variants v
  JOIN products p ON p.id = v.product_id
  WHERE v.id = target_variant_id;

  RETURN jsonb_build_object(
    'success', true,
    'previous_stock', current_stock + 1,
    'current_stock', current_stock,
    'product_id', product_record.id,
    'product_name', product_record.name,
    'size', product_record.size
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create function to check stock availability (for pre-flight checks)
CREATE OR REPLACE FUNCTION check_stock_availability(target_variant_id BIGINT)
RETURNS JSONB AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  SELECT stock_quantity INTO current_stock
  FROM variants
  WHERE id = target_variant_id;

  IF current_stock IS NULL THEN
    RETURN jsonb_build_object(
      'available', false,
      'error', 'Variant not found'
    );
  END IF;

  RETURN jsonb_build_object(
    'available', current_stock > 0,
    'stock_quantity', current_stock
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Add trust_points column to users table if it doesn't exist
DO $$
BEGIN
  -- Check if auth.users table exists and has the trust_points column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' 
    AND table_name = 'users' 
    AND column_name = 'trust_points'
  ) THEN
    -- If using a custom users table in public schema
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' 
      AND table_name = 'users'
    ) THEN
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trust_points INTEGER DEFAULT 0;
    END IF;
  END IF;
END $$;

-- 11. Create function to award trust points
CREATE OR REPLACE FUNCTION award_trust_points(user_id UUID, points INTEGER)
RETURNS VOID AS $$
BEGIN
  -- Try to update in public.users table if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
  ) THEN
    UPDATE public.users
    SET trust_points = COALESCE(trust_points, 0) + points
    WHERE id = user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_variants_updated_at ON variants;
CREATE TRIGGER update_variants_updated_at
  BEFORE UPDATE ON variants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 13. Enable realtime for variants table (if realtime is available)
DO $$
BEGIN
  -- This will only work if you have realtime enabled in your Supabase project
  -- If it fails, you'll need to enable it manually in the Supabase dashboard
  ALTER PUBLICATION supabase_realtime ADD TABLE variants;
EXCEPTION
  WHEN undefined_object THEN
    RAISE NOTICE 'Realtime publication not found. Please enable realtime manually in Supabase dashboard.';
  WHEN duplicate_object THEN
    RAISE NOTICE 'Table already added to realtime publication.';
END $$;

-- Add helpful comments
COMMENT ON TABLE variants IS 'Stores product variants with size-specific inventory';
COMMENT ON TABLE sales_history IS 'Logs all sales (physical and online) for analytics';
COMMENT ON FUNCTION deduct_stock IS 'Safely deducts stock with race condition protection';
COMMENT ON FUNCTION check_stock_availability IS 'Checks if a variant has stock available';
COMMENT ON FUNCTION award_trust_points IS 'Awards trust points to users for completing actions';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Physical Sale Sync migration completed successfully!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Verify tables created: variants, sales_history';
  RAISE NOTICE '2. Enable realtime on variants table in Supabase Dashboard if not already enabled';
  RAISE NOTICE '3. Test the feature in your app';
END $$;
