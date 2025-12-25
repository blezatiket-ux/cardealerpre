const fetch = require('node-fetch');

exports.handler = async (event) => {
    console.log('=== DISCORD AUTH DEBUG ===');
    console.log('HTTP Method:', event.httpMethod);
    
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }
    
    try {
        const body = JSON.parse(event.body);
        const { code } = body;
        
        console.log('Received code:', code ? 'Yes (length: ' + code.length + ')' : 'No');
        
        if (!code) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'No authorization code provided' })
            };
        }
        
        // Check environment variables
        console.log('Checking environment variables...');
        const envVars = {
            DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID ? '✓ Set' : '✗ Missing',
            DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET ? '✓ Set' : '✗ Missing',
            DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI ? '✓ Set' : '✗ Missing',
            DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID ? '✓ Set' : '✗ Missing',
            DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN ? '✓ Set' : '✗ Missing'
        };
        console.log('Env vars:', JSON.stringify(envVars, null, 2));
        
        // Exchange code for access token
        console.log('Exchanging code for token...');
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
        
        console.log('Token response status:', tokenResponse.status);
        const tokenData = await tokenResponse.json();
        console.log('Token data:', JSON.stringify(tokenData, null, 2));
        
        if (!tokenResponse.ok || !tokenData.access_token) {
            console.error('Token exchange failed:', tokenData);
            return {
                statusCode: 401,
                body: JSON.stringify({ 
                    error: 'Failed to get access token from Discord',
                    details: tokenData.error_description || tokenData.error || 'Unknown error',
                    debug: tokenData
                })
            };
        }
        
        console.log('Token exchange successful!');
        
        // Get user info from Discord
        console.log('Fetching user info...');
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });
        
        console.log('User response status:', userResponse.status);
        const userData = await userResponse.json();
        console.log('User data:', JSON.stringify(userData, null, 2));
        
        if (!userResponse.ok) {
            return {
                statusCode: 401,
                body: JSON.stringify({ 
                    error: 'Failed to get user info',
                    debug: userData
                })
            };
        }
        
        // Get user's guilds
        console.log('Fetching user guilds...');
        const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });
        
        console.log('Guilds response status:', guildsResponse.status);
        const guilds = await guildsResponse.json();
        console.log('User guilds:', Array.isArray(guilds) ? guilds.length + ' guilds' : 'Error');
        
        // Get your Discord server ID
        const YOUR_GUILD_ID = process.env.DISCORD_GUILD_ID;
        console.log('Looking for guild ID:', YOUR_GUILD_ID);
        
        // Check if user is in your guild
        const userGuild = Array.isArray(guilds) ? guilds.find(guild => guild.id === YOUR_GUILD_ID) : null;
        console.log('User in guild?', userGuild ? '✓ Yes' : '✗ No');
        
        if (!userGuild) {
            console.log('Guilds user IS in:', Array.isArray(guilds) ? guilds.map(g => g.name).join(', ') : 'N/A');
            
            return {
                statusCode: 403,
                body: JSON.stringify({ 
                    error: 'You must be a member of our Discord server to access the dealership',
                    requiredGuildId: YOUR_GUILD_ID,
                    userGuilds: Array.isArray(guilds) ? guilds.map(g => ({ id: g.id, name: g.name })) : [],
                    user: {
                        id: userData.id,
                        username: userData.username
                    }
                })
            };
        }
        
        console.log('User found in guild:', userGuild.name);
        
        // Get user's roles in your guild using BOT token
        console.log('Fetching user roles with bot token...');
        const memberResponse = await fetch(`https://discord.com/api/guilds/${YOUR_GUILD_ID}/members/${userData.id}`, {
            headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`
            }
        });
        
        console.log('Member response status:', memberResponse.status);
        
        let userRole = 'customer';
        let memberData = null;
        
        if (memberResponse.ok) {
            memberData = await memberResponse.json();
            console.log('Member data:', JSON.stringify(memberData, null, 2));
            
            if (memberData.roles && memberData.roles.length > 0) {
                console.log('User roles:', memberData.roles);
                
                // Get role IDs from environment
                const ROLE_IDS = {
                    owner: process.env.ROLE_OWNER_ID,
                    manager: process.env.ROLE_MANAGER_ID,
                    customer: process.env.ROLE_CUSTOMER_ID
                };
                
                console.log('Configured role IDs:', ROLE_IDS);
                
                // Check roles
                if (ROLE_IDS.owner && memberData.roles.includes(ROLE_IDS.owner)) {
                    userRole = 'owner';
                    console.log('Role assigned: owner');
                } else if (ROLE_IDS.manager && memberData.roles.includes(ROLE_IDS.manager)) {
                    userRole = 'manager';
                    console.log('Role assigned: manager');
                } else if (ROLE_IDS.customer && memberData.roles.includes(ROLE_IDS.customer)) {
                    userRole = 'customer';
                    console.log('Role assigned: customer');
                } else {
                    userRole = 'member';
                    console.log('Role assigned: member (no specific role)');
                }
            } else {
                console.log('User has no roles in this guild');
                userRole = 'guest';
            }
        } else {
            const errorText = await memberResponse.text();
            console.error('Failed to get member data:', errorText);
            userRole = 'customer'; // Fallback
        }
        
        console.log('Final user role:', userRole);
        
        // Create token
        const tokenPayload = {
            userId: userData.id,
            username: userData.username,
            discriminator: userData.discriminator,
            avatar: userData.avatar,
            global_name: userData.global_name,
            role: userRole,
            guildId: YOUR_GUILD_ID,
            iat: Date.now(),
            exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
        };
        
        const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
        
        console.log('Auth successful! Returning data...');
        console.log('User role for UI:', userRole);
        console.log('User data for UI:', {
            id: userData.id,
            username: userData.username,
            avatar: userData.avatar
        });
        console.log('=== END DEBUG ===');
        
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
                memberSince: new Date().toISOString(),
                debug: {
                    guildId: YOUR_GUILD_ID,
                    rolesChecked: memberData?.roles || []
                }
            })
        };
        
    } catch (error) {
        console.error('DISCORD AUTH ERROR:', error);
        console.error('Error stack:', error.stack);
        
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};