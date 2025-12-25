const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const authHeader = event.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'No token provided' })
    };
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const orderData = JSON.parse(event.body);
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Create order
    const { data: order, error } = await supabase
      .from('orders')
      .insert([{
        discord_id: decoded.discord_id,
        customer_name: decoded.username,
        vehicle_id: orderData.vehicleId,
        vehicle_name: orderData.vehicleName,
        price: orderData.price,
        primary_color: orderData.primaryColor,
        secondary_color: orderData.secondaryColor,
        pearl_color: orderData.pearlColor,
        special_requests: orderData.specialRequests,
        payment_method: orderData.paymentMethod,
        status: 'pending',
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Order submitted successfully',
        orderId: order.id,
        countdown: 600 // 10 minutes in seconds
      })
    };

  } catch (error) {
    console.error('Order submission error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to submit order' })
    };
  }
};