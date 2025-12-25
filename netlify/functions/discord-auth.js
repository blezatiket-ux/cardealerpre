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
                redirect_uri: process.env.DISCORD_REDIRECT_URI,
                scope: 'identify guilds guilds.members.read'
            })
        });
        
        const tokenData = await tokenResponse.json();
        
        if (!tokenData.access_token) {
            console.error('Token error:', tokenData);
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Failed to get access token: ' + (tokenData.error_description || 'Unknown error') })
            };
        }
        
        // Get user info from Discord
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });
        
        const userData = await userResponse.json();
        
        // Get user's guilds to check if they're in your server
        const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });
        
        const guilds = await guildsResponse.json();
        
        // Get your Discord server ID from environment variables
        const YOUR_GUILD_ID = process.env.DISCORD_GUILD_ID;
        
        // Check if user is in your guild
        const userGuild = guilds.find(guild => guild.id === YOUR_GUILD_ID);
        
        if (!userGuild) {
            return {
                statusCode: 403,
                body: JSON.stringify({ 
                    error: 'Not a member of the required Discord server',
                    user: userData
                })
            };
        }
        
        // Get user's roles in your guild
        const memberResponse = await fetch(`https://discord.com/api/guilds/${YOUR_GUILD_ID}/members/${userData.id}`, {
            headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`
            }
        });
        
        let userRole = 'customer'; // Default role
        const memberData = await memberResponse.json();
        
        if (memberData.roles && memberData.roles.length > 0) {
            // Get role names from your Discord server
            // You need to configure these role IDs in environment variables
            const ROLE_IDS = {
                owner: process.env.ROLE_OWNER_ID,
                manager: process.env.ROLE_MANAGER_ID,
                customer: process.env.ROLE_CUSTOMER_ID
            };
            
            // Check for specific role IDs
            if (memberData.roles.includes(ROLE_IDS.owner)) {
                userRole = 'owner';
            } else if (memberData.roles.includes(ROLE_IDS.manager)) {
                userRole = 'manager';
            } else if (memberData.roles.includes(ROLE_IDS.customer)) {
                userRole = 'customer';
            }
            
            // You can add more role checks as needed
        }
        
        // Create a simple token (in production, use JWT)
        const token = Buffer.from(JSON.stringify({
            userId: userData.id,
            username: userData.username,
            role: userRole,
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
                    discriminator: userData.discriminator,
                    global_name: userData.global_name
                },
                role: userRole,
                guild: userGuild.name
            })
        };
        
    } catch (error) {
        console.error('Discord auth error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error: ' + error.message })
        };
    }
};