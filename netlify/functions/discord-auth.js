const fetch = require('node-fetch');

exports.handler = async (event) => {
    console.log('🎮 DISCORD AUTH STARTED 🎮');
    console.log('========================================');
    
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }
    
    try {
        const { code } = JSON.parse(event.body);
        
        if (!code) {
            return { statusCode: 400, body: JSON.stringify({ error: 'No authorization code' }) };
        }
        
        // 1. EXCHANGE CODE FOR TOKEN
        console.log('🔄 Exchanging code for token...');
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
            console.error('❌ Token error:', tokenData);
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'Discord auth failed', details: tokenData }) 
            };
        }
        
        console.log('✅ Got Discord access token');
        
        // 2. GET USER INFO
        console.log('👤 Getting user info...');
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        
        const userData = await userResponse.json();
        console.log(`✅ User: ${userData.username}#${userData.discriminator} (ID: ${userData.id})`);
        
        // 3. CHECK GUILD MEMBERSHIP
        console.log('🏢 Getting user guilds...');
        const guildsResponse = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        
        const guilds = await guildsResponse.json();
        const requiredGuildId = process.env.DISCORD_GUILD_ID;
        
        console.log(`🔍 Looking for guild ID: ${requiredGuildId}`);
        console.log(`📊 User is in ${guilds.length} guild(s)`);
        
        const isInGuild = guilds.some(guild => guild.id === requiredGuildId);
        
        if (!isInGuild) {
            console.log('❌ User not in required guild');
            console.log('User guilds:', guilds.map(g => `${g.name} (${g.id})`));
            return {
                statusCode: 403,
                body: JSON.stringify({ error: 'Join our Discord server first' })
            };
        }
        
        console.log('✅ User is in required guild');
        
        // 4. GET USER'S ROLES WITH DETAILED DEBUGGING
        console.log('🎭 GETTING USER ROLES...');
        console.log('========================================');
        
        let userRole = 'customer';
        let roleDetails = [];
        
        try {
            console.log(`📡 Fetching member data from Discord API...`);
            console.log(`🔗 URL: https://discord.com/api/guilds/${requiredGuildId}/members/${userData.id}`);
            console.log(`🔑 Using Bot Token: ${process.env.DISCORD_BOT_TOKEN ? 'Present' : 'MISSING!'}`);
            
            const memberResponse = await fetch(
                `https://discord.com/api/guilds/${requiredGuildId}/members/${userData.id}`, {
                headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
            });
            
            console.log(`📊 Response Status: ${memberResponse.status} ${memberResponse.statusText}`);
            
            if (memberResponse.ok) {
                const memberData = await memberResponse.json();
                console.log('✅ Successfully fetched member data');
                
                // Log ALL roles user has
                console.log(`🔍 User has ${memberData.roles.length} role(s):`);
                memberData.roles.forEach((roleId, index) => {
                    console.log(`   ${index + 1}. Role ID: ${roleId}`);
                });
                
                // Get all roles from the guild to see their names
                console.log('\n📋 Fetching ALL roles from the guild...');
                const rolesResponse = await fetch(
                    `https://discord.com/api/guilds/${requiredGuildId}/roles`, {
                    headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` }
                });
                
                if (rolesResponse.ok) {
                    const allRoles = await rolesResponse.json();
                    
                    console.log('🎯 ALL ROLES IN GUILD:');
                    allRoles.forEach(role => {
                        console.log(`   - ${role.name} (ID: ${role.id})`);
                        
                        if (memberData.roles.includes(role.id)) {
                            console.log(`     ✅ USER HAS THIS ROLE!`);
                            roleDetails.push(`${role.name} (${role.id})`);
                        }
                    });
                }
                
                // Check for specific roles
                console.log('\n🔎 CHECKING FOR SPECIFIC ROLES:');
                
                // Get role IDs from environment
                const ROLE_IDS = {
                    owner: process.env.ROLE_OWNER_ID,
                    manager: process.env.ROLE_MANAGER_ID,
                    customer: process.env.ROLE_CUSTOMER_ID
                };
                
                console.log('📝 Configured Role IDs:');
                console.log(`   - Owner:   ${ROLE_IDS.owner || 'NOT SET'}`);
                console.log(`   - Manager: ${ROLE_IDS.manager || 'NOT SET'}`);
                console.log(`   - Customer: ${ROLE_IDS.customer || 'NOT SET'}`);
                
                // Check each role
                console.log('\n🔍 Comparing user roles with configured IDs:');
                
                let hasOwner = ROLE_IDS.owner && memberData.roles.includes(ROLE_IDS.owner);
                let hasManager = ROLE_IDS.manager && memberData.roles.includes(ROLE_IDS.manager);
                let hasCustomer = ROLE_IDS.customer && memberData.roles.includes(ROLE_IDS.customer);
                
                console.log(`   ✓ Has Owner role?   ${hasOwner ? 'YES' : 'NO'}`);
                console.log(`   ✓ Has Manager role? ${hasManager ? 'YES' : 'NO'}`);
                console.log(`   ✓ Has Customer role? ${hasCustomer ? 'YES' : 'NO'}`);
                
                // Assign role based on priority
                if (hasOwner) {
                    userRole = 'owner';
                    console.log('👑 ASSIGNED ROLE: OWNER');
                } else if (hasManager) {
                    userRole = 'manager';
                    console.log('💼 ASSIGNED ROLE: MANAGER');
                } else if (hasCustomer) {
                    userRole = 'customer';
                    console.log('👤 ASSIGNED ROLE: CUSTOMER');
                } else if (memberData.roles.length > 0) {
                    userRole = 'member';
                    console.log('🌟 ASSIGNED ROLE: MEMBER (has roles but not specific ones)');
                } else {
                    console.log('🚫 User has no roles in this guild');
                    userRole = 'guest';
                }
                
            } else {
                const errorText = await memberResponse.text();
                console.error('❌ Failed to get member data:', errorText);
                console.log('⚠️ Using default role: customer');
                userRole = 'customer';
            }
            
        } catch (roleError) {
            console.error('💥 ERROR fetching roles:', roleError.message);
            console.log('⚠️ Using default role due to error');
            userRole = 'customer';
        }
        
        console.log('\n========================================');
        console.log(`🎯 FINAL ROLE ASSIGNMENT: ${userRole.toUpperCase()}`);
        console.log('========================================\n');
        
        // 5. CREATE TOKEN
        const tokenPayload = {
            userId: userData.id,
            username: userData.username,
            avatar: userData.avatar,
            global_name: userData.global_name,
            discriminator: userData.discriminator,
            role: userRole,
            roles: roleDetails,
            exp: Date.now() + (24 * 60 * 60 * 1000)
        };
        
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
                    global_name: userData.global_name,
                    avatar_url: userData.avatar 
                        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=256`
                        : `https://cdn.discordapp.com/embed/avatars/${userData.discriminator % 5}.png`
                },
                role: userRole,
                roleDetails: roleDetails,
                guild: guilds.find(g => g.id === requiredGuildId)?.name || 'GTA V Dealership',
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('💥 AUTH ERROR:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Authentication failed',
                message: error.message,
                stack: error.stack 
            })
        };
    }
};