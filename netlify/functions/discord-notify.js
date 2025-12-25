const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const notificationData = JSON.parse(event.body);
    const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
    
    if (!DISCORD_WEBHOOK_URL) {
      console.warn('Discord webhook URL not configured');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Webhook not configured' })
      };
    }
    
    let embed;
    
    switch (notificationData.type) {
      case 'new_order':
        embed = {
          title: '🚗 New Vehicle Order',
          color: 0xff4400,
          fields: [
            {
              name: 'Customer',
              value: notificationData.user,
              inline: true
            },
            {
              name: 'Vehicle',
              value: notificationData.vehicle,
              inline: true
            },
            {
              name: 'Price',
              value: `$${notificationData.price.toLocaleString()}`,
              inline: true
            },
            {
              name: 'Colors',
              value: `Primary: ${notificationData.colors.primary}\nSecondary: ${notificationData.colors.secondary}`
            }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'GTA V Dealership'
          }
        };
        break;
        
      case 'order_update':
        embed = {
          title: '📋 Order Status Updated',
          color: notificationData.status === 'approved' ? 0x00ff88 : 
                 notificationData.status === 'rejected' ? 0xff4757 : 0xffb142,
          fields: [
            {
              name: 'Order ID',
              value: notificationData.orderId.slice(0, 8),
              inline: true
            },
            {
              name: 'New Status',
              value: notificationData.status.toUpperCase(),
              inline: true
            }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'GTA V Dealership'
          }
        };
        break;
        
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid notification type' })
        };
    }
    
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        embeds: [embed]
      })
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Notification sent' })
    };
    
  } catch (error) {
    console.error('Discord notification error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send notification' })
    };
  }
};