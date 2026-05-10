import { useEffect, useState } from 'react';

export default function useReloj(intervaloMs = 60000) {
  const [ahora, setAhora] = useState(new Date());

  useEffect(() => {
    const ahoraInicial = new Date();
    const segundosHastaProximoMinuto = 60 - ahoraInicial.getSeconds();

    const timeout = setTimeout(() => {
      setAhora(new Date());

      const interval = setInterval(() => {
        setAhora(new Date());
      }, intervaloMs);

      return () => clearInterval(interval);
    }, segundosHastaProximoMinuto * 1000);

    return () => clearTimeout(timeout);
  }, [intervaloMs]);

  return ahora;
}
