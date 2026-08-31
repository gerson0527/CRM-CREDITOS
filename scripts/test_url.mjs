const params = new URLSearchParams();
params.set('select', '*,asesor:profiles!credits_asesor_id_fkey(id,full_name)');
console.log('Encoded:', params.toString());
console.log('Decoded:', new URLSearchParams(params.toString()).get('select'));
