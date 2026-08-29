// Barra horizontal simple en CSS/flex, sin librería externa.
export default function GraficoBarras({ datos, colorClase = 'bg-utec-primary', formatearValor = v => v }) {
  const max = Math.max(1, ...datos.map(d => d.valor || 0));

  if (datos.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">Sin datos en este alcance</p>;
  }

  return (
    <div className="space-y-2">
      {datos.map(d => (
        <div key={d.label} className="flex items-center gap-2 text-sm">
          <span className="w-32 flex-shrink-0 truncate text-gray-700" title={d.label}>{d.label}</span>
          <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
            <div
              className={`h-full rounded ${colorClase}`}
              style={{ width: `${Math.max(2, ((d.valor || 0) / max) * 100)}%` }}
            />
          </div>
          <span className="w-16 flex-shrink-0 text-right font-medium text-gray-800">{formatearValor(d.valor || 0)}</span>
        </div>
      ))}
    </div>
  );
}
