const fetch = require('node-fetch');

exports.handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }
    
    try {
        const { code } = JSON.parse(event.body);
        
        if (!code) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No authorization code provided' })
            };
        }
        
        // Exchange code for access token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: process.env.DISCORD_CLIENT_ID,
                client_secret: process.env.DISCORD_CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: process.env.DISCORD_REDIRECT_URI || 'http://localhost:3000/auth-callback.html',
                scope: 'identify guilds'
            })
        });
        
        const tokenData = await tokenResponse.json();
        
        if (!tokenData.access_token) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Failed to get access token' })
            };
        }
        
        // Get user info from Discord
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });
        
        const userData = await userResponse.json();
        
        // Get user's guilds to check roles
        const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });
        
        const guilds = await guildsResponse.json();
        
        // Determine user role based on guild membership/roles
        // This is a simplified example - you'll need to implement your own logic
        let role = 'customer';
        const YOUR_GUILD_ID = process.env.DISCORD_GUILD_ID; // Your Discord server ID
        
        // Check if user is in your guild
        const inGuild = guilds.some(guild => guild.id === YOUR_GUILD_ID);
        
        if (inGuild) {
            // You could fetch the user's roles in your guild here
            // For now, we'll assign a default role
            role = 'customer';
        }
        
        // Create a JWT or session token (simplified)
        const token = Buffer.from(JSON.stringify({
            userId: userData.id,
            username: userData.username,
            role: role,
            exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
        })).toString('base64');
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                token: token,
                user: {
                    id: userData.id,
                    username: userData.username,
                    avatar: userData.avatar,
                    discriminator: userData.discriminator
                },
                role: role
            })
        };
        
    } catch (error) {
        console.error('Discord auth error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};