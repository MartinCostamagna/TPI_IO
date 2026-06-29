import { Component, OnInit, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { TransporteService, MatrizTransporte } from '../../services/transporte.service';
import { Network, DataSet } from 'vis-network/standalone';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-grafo',
  imports: [DecimalPipe],
  templateUrl: './grafo.html',
  styleUrls: ['./grafo.css']
})
export class Grafo implements OnInit, AfterViewInit {
  @ViewChild('networkContainer', { static: true }) networkContainer!: ElementRef;

  matriz: MatrizTransporte | null = null;
  resultadosLp: any = null;
  costoTotal: number = 0;
  esFactible: boolean = false;
  analisisFabricas: any[] = [];
  analisisTiendas: any[] = [];
  analisisRutas: any[] = [];

  constructor(private transporteService: TransporteService, private router: Router) { }

  ngOnInit(): void {
    this.transporteService.matrizActual$.subscribe(datos => {
      if (datos) {
        this.matriz = datos;
        this.resultadosLp = this.transporteService.optimizarModelo(datos);
        this.costoTotal = this.resultadosLp.result || 0;
        this.esFactible = this.resultadosLp.feasible || false;
        if (this.esFactible) {
          this.calcularSensibilidad();
        }
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.matriz && this.resultadosLp) {
      this.dibujarGrafo();
    }
  }

  dibujarGrafo() {
    if (!this.matriz) return;

    const nodesArray: any[] = [];
    const edgesArray: any[] = [];

    // CREAMOS LOS NODOS
    this.matriz.fabricas.forEach((fab, i) => {
      nodesArray.push({
        id: `fab_${i}`,
        label: `${fab.nombre}\n(Ofer: ${fab.oferta})`,
        color: { background: '#EBF8FF', border: '#3182CE' },
        shape: 'ellipse',
        x: -200,
        y: i * 140
      });
    });

    //AGREGAR FÁBRICA FICTICIA SI EL MODELO TIENE DÉFICIT
    const ofertaTotal = this.matriz.fabricas.reduce((sum, f) => sum + f.oferta, 0);
    const demandaTotal = this.matriz.demandas.reduce((sum, d) => sum + d, 0);

    if (demandaTotal > ofertaTotal) {
      const deficit = demandaTotal - ofertaTotal;
      nodesArray.push({
        id: 'fab_ficticia',
        label: `Fábrica Ficticia\n(Déficit: ${deficit})`,
        color: { background: '#EDF2F7', border: '#718096' },
        shape: 'ellipse',
        x: -200,
        y: this.matriz.fabricas.length * 140
      });
    }

    // Crear Nodos de Tiendas
    this.matriz.tiendas.forEach((tienda, j) => {
      nodesArray.push({
        id: `tienda_${j}`,
        label: `${tienda}\n(Dem: ${this.matriz!.demandas[j]})`,
        color: { background: '#F0FFF4', border: '#38A169' },
        shape: 'ellipse',
        x: 200,
        y: j * 140
      });
    });

    // CREAMOS LAS FLECHAS

    // Arcos desde fábricas REALES hacia tiendas
    this.matriz.fabricas.forEach((fab, i) => {
      this.matriz!.tiendas.forEach((tienda, j) => {
        const varName = `x_${i}_${j}`;
        const cantidadEnviada = this.resultadosLp[varName] || 0;
        const costoUnitario = fab.costos[j];

        // CONDICIÓN: Si la ruta real lleva flujo óptimo, la agregamos con tooltip interactivo
        if (cantidadEnviada > 0) {
          edgesArray.push({
            from: `fab_${i}`,
            to: `tienda_${j}`,
            title: `Decisión Óptima:\n• Cantidad a enviar: ${cantidadEnviada} unidades\n• Costo Unitario: $${costoUnitario}/u`,
            arrows: 'to',
            color: { color: '#48BB78', highlight: '#3182CE', hover: '#2F855A' },
            width: 4
          });
        }
      });
    });

    // Arcos desde la Fábrica FICTICIA hacia las tiendas (Si hay déficit)
    if (demandaTotal > ofertaTotal) {
      this.matriz.tiendas.forEach((tienda, j) => {
        const varNameFicticia = `x_ficticia_${j}`;
        const deficitAsignado = this.resultadosLp[varNameFicticia] || 0;

        // Si el solver determina que esta tienda sufre el faltante, dibujamos la flecha gris
        if (deficitAsignado > 0) {
          edgesArray.push({
            from: 'fab_ficticia',
            to: `tienda_${j}`,
            title: `Déficit Estructural Asignado:\n• Cantidad no satisfecha: ${deficitAsignado} unidades\n• Costo de Oportunidad: $0/u`,
            arrows: 'to',
            color: {
              color: '#A0AEC0',
              highlight: '#3182CE',
              hover: '#4A5568'
            },
            width: 3,
            dashes: true
          });
        }
      });
    }

    // CONFIGURACIÓN E INICIALIZACIÓN DE VIS.JS
    const data = {
      nodes: new DataSet(nodesArray),
      edges: new DataSet(edgesArray)
    };

    const options = {
      physics: false,
      nodes: {
        font: { size: 14, face: 'Segoe UI', fontWeight: 'bold' },
        borderWidth: 2
      },
      edges: {
        smooth: {
          enabled: true,
          type: 'cubicBezier',
          roundness: 0.4
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 100
      }
    };

    new Network(this.networkContainer.nativeElement, data, options);
  }

  calcularSensibilidad() {
    if (!this.matriz || !this.resultadosLp) return;

    this.analisisFabricas = [];
    this.analisisTiendas = [];

    const numFab = this.matriz.fabricas.length;
    const numTiendas = this.matriz.tiendas.length;

    // Usamos arreglos con null para saber cuáles nodos ya calculamos y cuáles faltan
    const u: (number | null)[] = new Array(numFab).fill(null);
    const v: (number | null)[] = new Array(numTiendas).fill(null);

    let completado = false;

    while (!completado) {
      let cambios = false;

      const indexU = u.findIndex(val => val === null);
      if (indexU !== -1) {
        u[indexU] = 0;
        cambios = true;
      } else {
        const indexV = v.findIndex(val => val === null);
        if (indexV !== -1) {
          v[indexV] = 0;
          cambios = true;
        }
      }

      let propagando = true;
      while (propagando) {
        propagando = false;
        this.matriz.fabricas.forEach((fab, i) => {
          this.matriz!.tiendas.forEach((tienda, j) => {
            const cantidadEnviada = this.resultadosLp[`x_${i}_${j}`] || 0;

            if (cantidadEnviada > 0) {
              const costoUnitario = fab.costos[j];

              if (u[i] !== null && v[j] === null) {
                v[j] = costoUnitario - u[i]!;
                propagando = true;
                cambios = true;
              } else if (v[j] !== null && u[i] === null) {
                u[i] = costoUnitario - v[j]!;
                propagando = true;
                cambios = true;
              }
            }
          });
        });
      }

      completado = u.every(x => x !== null) && v.every(x => x !== null);
    }

    this.matriz.fabricas.forEach((fab, i) => {
      let precioSombraFinal = -u[i]!;

      if (Object.is(precioSombraFinal, -0)) precioSombraFinal = 0;

      this.analisisFabricas.push({
        nombre: fab.nombre,
        ofertaActual: fab.oferta,
        precioSombra: precioSombraFinal,
        interpretacion: precioSombraFinal === 0
          ? 'Capacidad balanceada sin impacto marginal.'
          : `El costo global del sistema cambiará en $${precioSombraFinal} por cada unidad extra.`
      });
    });

    const ofertaTotal = this.matriz.fabricas.reduce((sum, f) => sum + f.oferta, 0);
    const demandaTotal = this.matriz.demandas.reduce((sum, d) => sum + d, 0);

    if (demandaTotal > ofertaTotal) {
      let precioSombraFicticia = 0;

      this.matriz.tiendas.forEach((tienda, j) => {
        if ((this.resultadosLp[`x_ficticia_${j}`] || 0) > 0) {
          precioSombraFicticia = v[j]!;
        }
      });

      if (Object.is(precioSombraFicticia, -0)) precioSombraFicticia = 0;

      this.analisisFabricas.push({
        nombre: 'Fábrica Ficticia (Déficit)',
        ofertaActual: demandaTotal - ofertaTotal,
        precioSombra: Math.abs(precioSombraFicticia),
        interpretacion: `El costo global bajará en $${Math.abs(precioSombraFicticia)} por cada unidad extra de déficit permitido (ahorro de flete real).`
      });
    }

    this.matriz.tiendas.forEach((tienda, j) => {
      let precioSombraFinal = -v[j]!;

      if (Object.is(precioSombraFinal, -0)) precioSombraFinal = 0;

      this.analisisTiendas.push({
        nombre: tienda,
        demandaActual: this.matriz!.demandas[j],
        precioSombra: precioSombraFinal,
        interpretacion: `Cada unidad extra requerida aquí cambiará el costo global en $${Math.abs(precioSombraFinal)}.`
      });
    });

    this.analisisRutas = [];

    this.matriz.fabricas.forEach((fab, i) => {
      this.matriz!.tiendas.forEach((tienda, j) => {
        const cantidadEnviada = this.resultadosLp[`x_${i}_${j}`] || 0;
        const costoUnitario = fab.costos[j];

        const costoReducido = costoUnitario - u[i]! - v[j]!;

        let allowableIncrease: string | number;
        let allowableDecrease: string | number;

        if (cantidadEnviada === 0) {
          allowableIncrease = '∞ (Infinito)';
          allowableDecrease = Math.abs(costoReducido);
        } else {
          allowableIncrease = 'Varía s/ Base';
          allowableDecrease = 'Varía s/ Base';
        }

        this.analisisRutas.push({
          ruta: `${fab.nombre} → ${tienda}`,
          flujo: cantidadEnviada,
          costoOriginal: costoUnitario,
          costoReducido: Math.abs(costoReducido),
          allowableIncrease: allowableIncrease,
          allowableDecrease: allowableDecrease
        });
      });
    });

    // AGREGAMOS LAS RUTAS DE LA FÁBRICA FICTICIA (Si hay déficit)
    if (demandaTotal > ofertaTotal) {
      let u_ficticia = 0;
      this.matriz.tiendas.forEach((tienda, j) => {
        if ((this.resultadosLp[`x_ficticia_${j}`] || 0) > 0) {
          u_ficticia = -v[j]!;
        }
      });

      this.matriz.tiendas.forEach((tienda, j) => {
        const cantidadEnviada = this.resultadosLp[`x_ficticia_${j}`] || 0;
        const costoReducido = 0 - u_ficticia - v[j]!;

        this.analisisRutas.push({
          ruta: `Fábrica Ficticia → ${tienda}`,
          flujo: cantidadEnviada,
          costoOriginal: 0,
          costoReducido: Math.abs(costoReducido),
          allowableIncrease: cantidadEnviada === 0 ? '∞ (Infinito)' : 'Varía s/ Base',
          allowableDecrease: cantidadEnviada === 0 ? Math.abs(costoReducido) : 'Varía s/ Base'
        });
      });
    }
  }

  volver() {
    this.router.navigate(['/']);
  }
}