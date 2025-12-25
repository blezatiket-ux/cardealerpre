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
        
        if (!tokenResponse.ok || !tokenData.access_token) {
            console.error('Discord token error:', tokenData);
            return {
                statusCode: 401,
                body: JSON.stringify({ 
                    error: 'Failed to get access token',
                    details: tokenData.error_description || 'Unknown error'
                })
            };
        }
        
        // Get user info from Discord
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });
        
        if (!userResponse.ok) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: 'Failed to get user info from Discord' })
            };
        }
        
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
                    error: 'You must be a member of our Discord server to access the dealership',
                    user: userData
                })
            };
        }
        
        // Get user's roles in your guild using BOT token
        const memberResponse = await fetch(`https://discord.com/api/guilds/${YOUR_GUILD_ID}/members/${userData.id}`, {
            headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`
            }
        });
        
        let userRole = 'customer'; // Default role
        
        if (memberResponse.ok) {
            const memberData = await memberResponse.json();
            
            if (memberData.roles && memberData.roles.length > 0) {
                // Get role IDs from environment variables
                const ROLE_IDS = {
                    owner: process.env.ROLE_OWNER_ID,
                    manager: process.env.ROLE_MANAGER_ID,
                    customer: process.env.ROLE_CUSTOMER_ID
                };
                
                // Check for specific role IDs (owner has highest priority)
                if (ROLE_IDS.owner && memberData.roles.includes(ROLE_IDS.owner)) {
                    userRole = 'owner';
                } else if (ROLE_IDS.manager && memberData.roles.includes(ROLE_IDS.manager)) {
                    userRole = 'manager';
                } else if (ROLE_IDS.customer && memberData.roles.includes(ROLE_IDS.customer)) {
                    userRole = 'customer';
                } else {
                    // User has roles but not the specific ones we're looking for
                    userRole = 'member';
                }
            } else {
                // User has no roles in the guild
                userRole = 'guest';
            }
        } else {
            console.error('Failed to get member data:', await memberResponse.text());
            // Fallback to customer role if we can't fetch roles
            userRole = 'customer';
        }
        
        // Create a JWT-like token (in production, use a proper JWT library)
        const tokenPayload = {
            userId: userData.id,
            username: userData.username,
            discriminator: userData.discriminator,
            avatar: userData.avatar,
            global_name: userData.global_name,
            role: userRole,
            guildId: YOUR_GUILD_ID,
            iat: Date.now(),
            exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
        };
        
        // Base64 encode the token
        const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
        
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
                guild: userGuild.name,
                memberSince: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Discord auth error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
};