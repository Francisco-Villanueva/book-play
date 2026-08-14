// Sin esto, un '%' tipeado en el buscador matchea todo y un '_' matchea
// cualquier caracter — el usuario espera búsqueda literal, no comodines.
// No es inyección (Sequelize parametriza), pero en un endpoint público un
// patrón como '%%%%%' es un scan completo servido a cualquiera.
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// El patrón "contiene" ya escapado, que es como se usa en el 100% de los casos.
export function containsPattern(value: string): string {
  return `%${escapeLikePattern(value)}%`;
}
