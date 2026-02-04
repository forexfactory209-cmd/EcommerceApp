DROP FUNCTION IF EXISTS accept_brand_order(uuid);
DROP FUNCTION IF EXISTS accept_brand_order(bigint);

CREATE OR REPLACE FUNCTION accept_brand_order(target_order_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_authorized BOOLEAN;
    updated_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Check if the user is authorized (has items in this order or owns the order)
    SELECT EXISTS (
        SELECT 1 FROM order_items WHERE order_id = target_order_id AND brand_user_id = auth.uid()
        UNION
        SELECT 1 FROM orders WHERE id = target_order_id AND brand_user_id = auth.uid()
    ) INTO is_authorized;

    IF NOT is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized to manage this order');
    END IF;

    updated_date := NOW();

    -- Update the order status and accepted timestamp
    UPDATE orders
    SET brand_accepted_at = updated_date,
        status = 'accepted'
    WHERE id = target_order_id;

    RETURN jsonb_build_object('success', true, 'timestamp', updated_date);
END;
$$;

DROP FUNCTION IF EXISTS decline_brand_order(uuid, text);
DROP FUNCTION IF EXISTS decline_brand_order(bigint, text);

CREATE OR REPLACE FUNCTION decline_brand_order(target_order_id BIGINT, reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_authorized BOOLEAN;
BEGIN
    -- Check if the user is authorized
    SELECT EXISTS (
        SELECT 1 FROM order_items WHERE order_id = target_order_id AND brand_user_id = auth.uid()
        UNION
        SELECT 1 FROM orders WHERE id = target_order_id AND brand_user_id = auth.uid()
    ) INTO is_authorized;

    IF NOT is_authorized THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized to manage this order');
    END IF;

    -- Update the order status
    UPDATE orders
    SET status = 'declined',
        decline_reason = reason
    WHERE id = target_order_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
