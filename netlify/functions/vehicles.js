const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Get all active vehicles
    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) throw error;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(vehicles || [])
    };

  } catch (error) {
    console.error('Vehicles error:', error);
    
    // Fallback to default vehicles if database fails
    const defaultVehicles = [
      {
        id: 1,
        name: "Karin Sultan",
        price: 250000,
        class: "Sports",
        category: "sedan",
        seats: 4,
        topSpeed: "210 km/h",
        acceleration: "5.2s",
        description: "Classic Japanese sports sedan",
        stock: 5,
        is_active: true
      },
      {
        id: 2,
        name: "Bravado Buffalo",
        price: 350000,
        class: "Muscle",
        category: "muscle",
        seats: 4,
        topSpeed: "230 km/h",
        acceleration: "4.8s",
        description: "Modern American muscle car",
        stock: 3,
        is_active: true
      },
      {
        id: 3,
        name: "Pfister Comet",
        price: 450000,
        class: "Sports",
        category: "sports",
        seats: 2,
        topSpeed: "240 km/h",
        acceleration: "4.2s",
        description: "German sports car",
        stock: 2,
        is_active: true
      }
    ];
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(defaultVehicles)
    };
  }
};