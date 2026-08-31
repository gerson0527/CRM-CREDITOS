const re = /^([a-z_][a-z0-9_]*):([a-z_][a-z0-9_]*)(?:!([a-z_][a-z0-9_]*))?\(([^)]*)\)$/;
const tests = [
  'asesor:profiles(id,full_name)',
  'asesor:profiles!credits_asesor_id_fkey(id,full_name)',
  'client:clients(*)',
  'asesor:profiles!fk(id,full_name)',
  'asesor:profiles(id,full_name)',
];
for (const t of tests) {
  const m = re.exec(t);
  console.log(t, '=>', m ? m.slice(1) : 'NO MATCH');
}
