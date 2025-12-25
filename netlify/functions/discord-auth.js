const fetch = require('node-fetch');

exports.handler = async (event) => {
    // Log start
    console.log('🎮 DISCORD AUTH STARTED 🎮');
    
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
                body: JSON.stringify({ error: 'No authorization code' })
            };
        }
        
        // 1. EXCHANGE CODE FOR TOKEN
        console.log('🔄 Exchanging code for token...');
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
                scope: 'identify guilds'
            })
        });
        
        const tokenData = await tokenResponse.json();
        
        if (!tokenData.access_token) {
            console.error('❌ Token error:', tokenData);
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    error: 'Discord auth failed', 
                    details: tokenData.error_description || 'Check Discord app settings'
                })
            };
        }
        
        console.log('✅ Got Discord access token');
        
        // 2. GET USER INFO
        console.log('👤 Getting user info...');
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });
        
        const userData = await userResponse.json();
        console.log('✅ User data:', userData.username);
        
        // 3. GET USER'S SERVERS (GUILDS)
        console.log('🏢 Getting user guilds...');
        const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });
        
        const guilds = await guildsResponse.json();
        
        // Check if user is in required guild
        const requiredGuildId = process.env.DISCORD_GUILD_ID;
        const isInGuild = guilds.some(guild => guild.id === requiredGuildId);
        
        if (!isInGuild) {
            console.log('❌ User not in required guild');
            return {
                statusCode: 403,
                body: JSON.stringify({
                    error: 'Join our Discord server first',
                    inviteLink: process.env.DISCORD_INVITE_LINK || 'https://discord.gg/your-server'
                })
            };
        }
        
        console.log('✅ User is in required guild');
        
        // 4. GET USER'S ROLES IN GUILD (Using BOT token)
        console.log('🎭 Getting user roles...');
        let userRole = 'customer'; // Default role
        
        try {
            const memberResponse = await fetch(
                `https://discord.com/api/guilds/${requiredGuildId}/members/${userData.id}`, {
                headers: {
                    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`
                }
            });
            
            if (memberResponse.ok) {
                const memberData = await memberResponse.json();
                
                // DEBUG: Log all roles user has
                console.log('🔍 User roles IDs:', memberData.roles);
                
                // Define your Discord role IDs here
                const roleIds = {
                    owner: process.env.ROLE_OWNER_ID || '1182247506895798366',
                    manager: process.env.ROLE_MANAGER_ID || '1182247506895798365',
                    customer: process.env.ROLE_CUSTOMER_ID || '1182247506895798364'
                };
                
                console.log('🔍 Configured role IDs:', roleIds);
                
                // Check roles in priority order
                if (memberData.roles.includes(roleIds.owner)) {
                    userRole = 'owner';
                    console.log('👑 User is OWNER');
                } else if (memberData.roles.includes(roleIds.manager)) {
                    userRole = 'manager';
                    console.log('💼 User is MANAGER');
                } else if (memberData.roles.includes(roleIds.customer)) {
                    userRole = 'customer';
                    console.log('👤 User is CUSTOMER');
                } else if (memberData.roles.length > 0) {
                    userRole = 'member';
                    console.log('🌟 User is MEMBER');
                }
            }
        } catch (roleError) {
            console.warn('⚠️ Could not fetch roles, using default:', roleError.message);
        }
        
        // 5. CREATE AUTH TOKEN
        const tokenPayload = {
            userId: userData.id,
            username: userData.username,
            avatar: userData.avatar,
            global_name: userData.global_name,
            discriminator: userData.discriminator,
            role: userRole,
            exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        };
        
        const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
        
        console.log('🎉 AUTH SUCCESSFUL!');
        console.log('📋 Final data:', {
            username: userData.username,
            role: userRole,
            userId: userData.id
        });
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                token: token,
                user: {
                    id: userData.id,
                    username: userData.username,
                    avatar: userData.avatar,
                    discriminator: userData.discriminator,
                    global_name: userData.global_name,
                    avatar_url: userData.avatar 
                        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
                        : null
                },
                role: userRole,
                guild: guilds.find(g => g.id === requiredGuildId)?.name || 'GTA V Dealership'
            })
        };
        
    } catch (error) {
        console.error('💥 AUTH ERROR:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Authentication failed',
                message: error.message 
            })
        };
    }
};