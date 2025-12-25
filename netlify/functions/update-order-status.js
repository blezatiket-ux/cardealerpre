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
    
    // Check if user has admin privileges
    if (decoded.role !== 'owner' && decoded.role !== 'manager') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Insufficient permissions' })
      };
    }
    
    const { orderId, status } = JSON.parse(event.body);
    
    if (!['pending', 'approved', 'rejected', 'delivered'].includes(status)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid status' })
      };
    }
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Update order status
    const { data: order, error } = await supabase
      .from('orders')
      .update({
        status: status,
        updated_at: new Date().toISOString(),
        approved_by: decoded.discord_id
      })
      .eq('id', orderId)
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
        message: 'Order status updated',
        order: order
      })
    };

  } catch (error) {
    console.error('Update order error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update order' })
    };
  }
};