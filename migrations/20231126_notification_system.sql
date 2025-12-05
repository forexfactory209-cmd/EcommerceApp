-- Create follows table
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, brand_id)
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data JSONB DEFAULT '{}'::jsonb
);

-- Add notification token to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_token TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_follows_user_id ON public.follows(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_brand_id ON public.follows(brand_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Enable RLS on new tables
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Follows policies
CREATE POLICY "Users can view their follows" ON public.follows
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create follows" ON public.follows
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their follows" ON public.follows
    FOR DELETE USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view their notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Brands can create notifications for their followers" ON public.notifications
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.brands 
            WHERE brands.id = brand_id 
            AND brands.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can mark notifications as read" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Function to notify followers
CREATE OR REPLACE FUNCTION public.notify_followers(
    p_brand_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_data JSONB DEFAULT '{}'::jsonb
) RETURNS void AS $$
BEGIN
    INSERT INTO public.notifications (user_id, brand_id, title, message, data)
    SELECT 
        f.user_id, 
        p_brand_id, 
        p_title, 
        p_message,
        p_data
    FROM 
        public.follows f
    WHERE 
        f.brand_id = p_brand_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
