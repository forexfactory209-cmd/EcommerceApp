# Quick Setup Guide - Physical Sale Sync Feature

## Step 1: Run Database Migration

You need to run the SQL migration to set up the database tables and functions.

### Option A: Using Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open the file: `supabase/migrations/20260202_physical_sale_sync.sql`
5. Copy all the SQL code
6. Paste it into the SQL Editor
7. Click **Run** button
8. Wait for success message

### Option B: Using Supabase CLI
```bash
# If you have Supabase CLI installed
cd EcommerceApp
supabase db push
```

## Step 2: Verify Installation

### Check Tables Created:
1. Go to **Table Editor** in Supabase Dashboard
2. You should see two new tables:
   - `variants`
   - `sales_history`

### Check Functions Created:
1. Go to **Database** → **Functions** in Supabase Dashboard
2. You should see:
   - `deduct_stock`
   - `check_stock_availability`
   - `award_trust_points`

### Check Realtime Enabled:
1. Go to **Database** → **Replication** in Supabase Dashboard
2. Ensure `variants` table is checked for realtime

## Step 3: Test the Feature

### As a Seller:
1. **Login as a brand user**
2. **Create a new product**:
   - Go to Products tab
   - Click "+" to add product
   - Fill in details
   - **Important**: Add sizes (e.g., "M, L, XL")
   - Click "Publish Product"
3. **Download QR Code**:
   - After creation, QR code appears automatically
   - Click "Download QR Code"
   - Save the image
4. **Test Scanning**:
   - Go to Home screen
   - Click the blue QR button (top right)
   - Grant camera permission if asked
   - Scan the QR code you downloaded
   - Select a size
   - Click the minus (-) button
   - See success screen!

### As a Buyer:
1. **Login as a customer**
2. **Browse products**
3. **Try to add out-of-stock items** (should be disabled)
4. **Real-time updates**: Have a seller deduct stock while you're viewing a product

## Step 4: Verify Data

### Check Variants Table:
```sql
SELECT * FROM variants;
```
You should see entries for each size of your products.

### Check Sales History:
```sql
SELECT * FROM sales_history WHERE sale_type = 'physical';
```
You should see logged physical sales.

### Check Trust Points:
```sql
SELECT id, email, trust_points FROM users WHERE trust_points > 0;
```
Sellers should have trust points after making physical sales.

## Troubleshooting

### Migration Fails:
- **Error**: "relation already exists"
  - Solution: Tables already created, you can skip this
- **Error**: "permission denied"
  - Solution: Make sure you're using the service role key or running as admin

### QR Code Won't Generate:
- Check that `react-native-qrcode-svg` is installed
- Verify product has an ID (saved to database)
- Check console for errors

### Scanner Won't Open:
- Grant camera permission in device settings
- Check that `expo-camera` is installed
- Verify you're logged in as a brand user

### Stock Not Deducting:
- Check internet connection
- Verify RPC function `deduct_stock` exists in database
- Check browser console for errors
- Ensure variant exists for the selected size

### Real-time Not Working:
- Verify realtime is enabled on `variants` table
- Check Supabase project settings → API → Realtime
- Ensure you're subscribed to the correct channel

## Production Checklist

Before deploying to production:

- [ ] Database migration executed successfully
- [ ] All RLS policies tested and working
- [ ] Realtime sync verified
- [ ] Camera permissions handled gracefully
- [ ] QR code generation tested on multiple devices
- [ ] Stock deduction race conditions tested
- [ ] Checkout validation prevents overselling
- [ ] Trust points system working
- [ ] Error messages are user-friendly
- [ ] Analytics/logging in place

## Next Steps

1. **Print QR Codes**: Print the generated QR codes and attach to physical products
2. **Train Staff**: Show sellers how to use the scanner
3. **Monitor Usage**: Check sales_history table for adoption
4. **Gather Feedback**: Ask sellers for improvement suggestions
5. **Iterate**: Add requested features (see PHYSICAL_SALE_SYNC_IMPLEMENTATION.md for ideas)

## Support

If you encounter any issues:
1. Check the console for error messages
2. Verify all dependencies are installed (`npm install`)
3. Ensure database migration ran successfully
4. Review the implementation documentation
5. Contact the development team

---

**Ready to go!** 🚀 Your Physical Sale Sync feature is now set up and ready to use.
