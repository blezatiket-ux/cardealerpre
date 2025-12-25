const fetch = require('node-fetch');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { code } = JSON.parse(event.body);
    
    // Discord API credentials from environment variables
    const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
    const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
    const DISCORD_REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
    const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
    const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    const JWT_SECRET = process.env.JWT_SECRET;
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: DISCORD_REDIRECT_URI,
        scope: 'identify guilds'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid authorization code' })
      };
    }

    // Get user info from Discord
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const userData = await userResponse.json();

    // Get user's guilds
    const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    const guilds = await guildsResponse.json();
    const isInGuild = guilds.some(guild => guild.id === DISCORD_GUILD_ID);

    if (!isInGuild) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'You must be a member of our Discord server' })
      };
    }

    // Get user's roles in the guild
    let userRole = 'customer';
    
    try {
      const memberResponse = await fetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${userData.id}`, {
        headers: { 
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (memberResponse.ok) {
        const memberData = await memberResponse.json();
        const roles = memberData.roles || [];
        
        // Check for specific role IDs from environment variables
        if (roles.includes(process.env.DISCORD_OWNER_ROLE_ID)) {
          userRole = 'owner';
        } else if (roles.includes(process.env.DISCORD_MANAGER_ROLE_ID)) {
          userRole = 'manager';
        } else if (roles.includes(process.env.DISCORD_CUSTOMER_ROLE_ID)) {
          userRole = 'customer';
        }
      }
    } catch (error) {
      console.warn('Could not fetch member roles:', error.message);
    }

    // Create or update user in database
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('discord_id', userData.id)
      .single();

    let userId;
    
    if (fetchError || !existingUser) {
      // Create new user
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          discord_id: userData.id,
          username: userData.username,
          discriminator: userData.discriminator,
          avatar: userData.avatar,
          role: userRole,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (insertError) throw insertError;
      userId = newUser.id;
    } else {
      // Update existing user
      const { error: updateError } = await supabase
        .from('users')
        .update({
          username: userData.username,
          avatar: userData.avatar,
          role: userRole,
          updated_at: new Date().toISOString()
        })
        .eq('discord_id', userData.id);

      if (updateError) throw updateError;
      userId = existingUser.id;
    }

    // Create JWT token
    const token = jwt.sign(
      {
        id: userId,
        discord_id: userData.id,
        username: userData.username,
        avatar: userData.avatar,
        role: userRole
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        token,
        user: {
          id: userData.id,
          username: userData.username,
          discriminator: userData.discriminator,
          avatar: userData.avatar,
          role: userRole
        }
      })
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};