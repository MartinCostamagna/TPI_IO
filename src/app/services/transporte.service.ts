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
  private matrizSource = new BehaviorSubject<MatrizTransporte | null>(null);
  matrizActual$ = this.matrizSource.asObservable();

  guardarMatriz(datos: MatrizTransporte) {
    this.matrizSource.next(datos);
  }

  // MÉTODO NUEVO: Calcula el modelo tal cual viene (Falla si Demanda > Oferta)
  optimizarModeloCrudo(matriz: MatrizTransporte): any {
    const model: any = {
      optimize: "cost",
      opType: "min",
      constraints: {},
      variables: {}
    };

    matriz.fabricas.forEach((fab, i) => {
      model.constraints[`fab_${i}`] = { max: fab.oferta };
    });

    matriz.tiendas.forEach((tienda, j) => {
      model.constraints[`tienda_${j}`] = { min: matriz.demandas[j] };
    });

    matriz.fabricas.forEach((fab, i) => {
      matriz.tiendas.forEach((tienda, j) => {
        const varName = `x_${i}_${j}`;
        model.variables[varName] = { cost: fab.costos[j] };
        model.variables[varName][`fab_${i}`] = 1;
        model.variables[varName][`tienda_${j}`] = 1;
      });
    });

    return solver.Solve(model);
  }

  // MÉTODO ORIGINAL: Calcula agregando la fábrica/tienda ficticia para balancear
  optimizarModeloBalanceado(matriz: MatrizTransporte): any {
    const model: any = {
      optimize: "cost",
      opType: "min",
      constraints: {},
      variables: {}
    };

    const ofertaTotal = matriz.fabricas.reduce((sum, f) => sum + f.oferta, 0);
    const demandaTotal = matriz.demandas.reduce((sum, d) => sum + d, 0);
    const diferencia = Math.abs(ofertaTotal - demandaTotal);

    matriz.fabricas.forEach((fab, i) => {
      model.constraints[`fab_${i}`] = { max: fab.oferta };
    });

    if (demandaTotal > ofertaTotal) {
      model.constraints['fab_ficticia'] = { max: diferencia };
    }

    matriz.tiendas.forEach((tienda, j) => {
      model.constraints[`tienda_${j}`] = { min: matriz.demandas[j] };
    });

    if (ofertaTotal > demandaTotal) {
      model.constraints['tienda_ficticia'] = { min: diferencia };
    }

    matriz.fabricas.forEach((fab, i) => {
      matriz.tiendas.forEach((tienda, j) => {
        const varName = `x_${i}_${j}`;
        model.variables[varName] = { cost: fab.costos[j] };
        model.variables[varName][`fab_${i}`] = 1;
        model.variables[varName][`tienda_${j}`] = 1;

        if (ofertaTotal > demandaTotal) {
          const varFicticiaNode = `x_${i}_ficticia`;
          if (!model.variables[varFicticiaNode]) {
            model.variables[varFicticiaNode] = { cost: 0 };
            model.variables[varFicticiaNode][`fab_${i}`] = 1;
            model.variables[varFicticiaNode]['tienda_ficticia'] = 1;
          }
        }
      });
    });

    if (demandaTotal > ofertaTotal) {
      matriz.tiendas.forEach((tienda, j) => {
        const varNameFicticia = `x_ficticia_${j}`;
        model.variables[varNameFicticia] = { cost: 0 };
        model.variables[varNameFicticia]['fab_ficticia'] = 1;
        model.variables[varNameFicticia][`tienda_${j}`] = 1;
      });
    }

    return solver.Solve(model);
  }
}