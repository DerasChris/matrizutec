import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

// MiComponente.jsx
export default function Servicios() {
  const items = [
    { id: 1, nombre: 'Practicas Libres', desc : 'Registro de prácticas libres', url : 'https://practicalibreutec.web.app/lab3.html', img : '/assets/img/practicalibre.png' },
    { id: 2, nombre: 'Admin Prácticas libres', desc : 'Control de prácticas libres', url : 'https://practicalibreutec.web.app/admin.html', img : '/assets/img/ltadmin.png'  },
    { id: 3, nombre: 'Instructores', desc : 'Control de Instructrores', url : 'https://instruattendance.web.app/admin', img : '/assets/img/ltcontrolinstru.png' },
    { id: 4, nombre: 'Realidad Aumentada', desc : 'Sistema de realidad Aumentada', url : 'https://realidadaumentadautec.web.app/', img : '/assets/img/vr.png' },
  ];

  return (
    <div className="w-full min-h-screen bg-white flex justify-center p-6">
      <div className="grid grid-cols-4 gap-8">
        {items.map((item) => (
          <div
            key={item.id}
            className="
              w-64 h-64
              bg-white
              rounded-2xl
              shadow-md
              border border-gray-100
              flex flex-col
              items-center
              justify-center
              gap-5
              transition-all
              hover:shadow-xl
              hover:-translate-y-1
            "
          >
            {/* CÍRCULO */}
            <div
              className="
                w-28 h-28
                rounded-full
                bg-gray-200
                border-4 border-gray-100
                overflow-hidden
                flex items-center justify-center
              "
            >
              {/* Imagen */}
              <img
                src={item.img}
                alt="placeholder"
                className="w-full h-full object-cover"
              />
            </div>

            <span>
                {item.desc}
            </span>

            {/* BOTÓN */}
            <a href={item.url} target="_blank">
                    <button
                className="
                    px-5 py-2
                    rounded-lg
                    bg-blue-600
                    text-white
                    font-medium
                    hover:bg-blue-700
                    transition-colors
                "
                >
                {item.nombre}
                </button>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
