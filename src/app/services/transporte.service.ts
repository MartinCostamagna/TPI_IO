import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
// @ts-ignore
import solver from 'javascript-lp-solver';

export interface MatrizTransporte {
  tiendas: string[];
  fabricas: { nombre: string; costos: number[]; oferta: number; }[];
  demandas: number[];
}

@Injectable({
  providedIn: 'root'
})
export class TransporteService {
  // Estado que almacena la matriz actual
  private matrizSource = new BehaviorSubject<MatrizTransporte | null>(null);
  matrizActual$ = this.matrizSource.asObservable();

  guardarMatriz(datos: MatrizTransporte) {
    this.matrizSource.next(datos);
  }

  optimizarModelo(matriz: MatrizTransporte): any {
    const model: any = {
      optimize: "cost",
      opType: "min",
      constraints: {},
      variables: {}
    };

    // 1. Definir restricciones de Oferta (Fábricas)
    matriz.fabricas.forEach((fab, i) => {
      model.constraints[`fab_${i}`] = { max: fab.oferta };
    });

    // 2. Definir restricciones de Demanda (Tiendas)
    matriz.tiendas.forEach((tienda, j) => {
      model.constraints[`tienda_${j}`] = { min: matriz.demandas[j] };
    });

    // 3. Generar las variables de decisión dinámicamente (Arcos Xij)
    matriz.fabricas.forEach((fab, i) => {
      matriz.tiendas.forEach((tienda, j) => {
        const varName = `x_${i}_${j}`; // Ejemplo: x_0_1 (Fábrica I a Tienda B)

        model.variables[varName] = {
          cost: fab.costos[j]
        };
        // Vinculamos la variable a sus respectivas restricciones
        model.variables[varName][`fab_${i}`] = 1;
        model.variables[varName][`tienda_${j}`] = 1;
      });
    });

    // Resolvemos usando javascript-lp-solver
    return solver.Solve(model);
  }
}