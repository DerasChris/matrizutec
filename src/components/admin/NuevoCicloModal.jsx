import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import { TIPOS_CICLO } from '../../lib/constants';
import { crearCiclo } from '../../services/ciclosService';
import toast from 'react-hot-toast';

export default function NuevoCicloModal({ onClose, onCreado }) {
  const anioActual = new Date().getFullYear();

  const [anio, setAnio] = useState(anioActual);
  const [tipoIdx, setTipoIdx] = useState(2); // por defecto Interciclo
  const [nombre, setNombre] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [guardando, setGuardando] = useState(false);

  const tipo = TIPOS_CICLO[tipoIdx];

  useEffect(() => {
    const t = TIPOS_CICLO[tipoIdx];
    setNombre(`${t.nombre} ${anio}`);
    setFechaInicio(t.fechaInicioSugerida(anio));
    setFechaFin(t.fechaFinSugerida(anio));
  }, [tipoIdx, anio]);

  const idGenerado = `ciclo_${tipo.codigo}_${anio}`;

  async function handleGuardar(e) {
    e.preventDefault();
    if (!fechaInicio || !fechaFin) {
      toast.error('Las fechas de inicio y fin son requeridas.');
      return;
    }
    if (fechaFin < fechaInicio) {
      toast.error('La fecha de fin no puede ser antes de la de inicio.');
      return;
    }
    setGuardando(true);
    try {
      const nuevo = await crearCiclo({
        anio: Number(anio),
        numero: tipo.numero,
        nombre: nombre.trim(),
        fechaInicio,
        fechaFin,
      });
      toast.success(`Ciclo "${nuevo.nombre}" creado.`);
      onCreado(nuevo);
      onClose();
    } catch (err) {
      toast.error(err.message || 'Error al crear el ciclo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Nuevo ciclo académico</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleGuardar} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de ciclo</label>
              <select
                value={tipoIdx}
                onChange={e => setTipoIdx(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utec-primary"
              >
                {TIPOS_CICLO.map((t, i) => (
                  <option key={t.codigo} value={i}>{t.corto} — {t.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
              <input
                type="number"
                value={anio}
                onChange={e => setAnio(Number(e.target.value))}
                min={2024}
                max={2099}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utec-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del ciclo</label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              maxLength={60}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utec-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de inicio</label>
              <input
                type="date"
                value={fechaInicio}
                onChange={e => setFechaInicio(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utec-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de fin</label>
              <input
                type="date"
                value={fechaFin}
                onChange={e => setFechaFin(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-utec-primary"
              />
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
            <span className="text-gray-500">ID en Firestore: </span>
            <code className="font-mono text-utec-primary font-semibold">{idGenerado}</code>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-utec-primary rounded-lg hover:bg-utec-dark disabled:opacity-50"
            >
              <Plus size={16} />
              {guardando ? 'Creando...' : 'Crear ciclo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
