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

  constructor(private transporteService: TransporteService, private router: Router) { }

  ngOnInit(): void {
    // Nos suscribimos a los datos compartidos
    this.transporteService.matrizActual$.subscribe(datos => {
      if (datos) {
        this.matriz = datos;
        // Ejecutamos el solver matemático
        this.resultadosLp = this.transporteService.optimizarModelo(datos);
        this.costoTotal = this.resultadosLp.result || 0;
        this.esFactible = this.resultadosLp.feasible || false;
      } else {
        // Si no hay datos cargados, volvemos al inicio
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

    // 1. Crear Nodos de Fábricas (Columna Izquierda)
    this.matriz.fabricas.forEach((fab, i) => {
      nodesArray.push({
        id: `fab_${i}`,
        label: `${fab.nombre}\n(Ofer: ${fab.oferta})`,
        color: { background: '#EBF8FF', border: '#3182CE' },
        shape: 'ellipse',
        x: -200,
        y: i * 120
      });
    });

    // 2. Crear Nodos de Tiendas (Columna Derecha)
    this.matriz.tiendas.forEach((tienda, j) => {
      nodesArray.push({
        id: `tienda_${j}`,
        label: `${tienda}\n(Dem: ${this.matriz!.demandas[j]})`,
        color: { background: '#F0FFF4', border: '#38A169' },
        shape: 'ellipse',
        x: 200,
        y: j * 120
      });
    });

    // 3. Crear Arcos dinámicamente basados en la solución óptima (Z)
    this.matriz.fabricas.forEach((fab, i) => {
      this.matriz!.tiendas.forEach((tienda, j) => {
        const varName = `x_${i}_${j}`;
        const cantidadEnviada = this.resultadosLp[varName] || 0;
        const costoUnitario = fab.costos[j];

        // Evaluamos si la ruta lleva flujo en la solución óptima
        const llevaFlujo = cantidadEnviada > 0;

        edgesArray.push({
          from: `fab_${i}`,
          to: `tienda_${j}`,
          label: `Envia: ${cantidadEnviada}\n($${costoUnitario}/u)`,
          font: { size: 11, color: llevaFlujo ? '#2F855A' : '#A0AEC0', align: 'top' },
          arrows: 'to',
          color: {
            color: llevaFlujo ? '#48BB78' : '#E2E8F0', // Verde si se usa, gris tenue si no se usa
            highlight: '#3182CE'
          },
          width: llevaFlujo ? 3 : 1, // Flecha más gruesa si transporta unidades
          dashes: !llevaFlujo // Línea punteada si está inactiva (ruta ineficiente) 
        });
      });
    });

    // Configuración de visualización de Vis.js
    const data = {
      nodes: new DataSet(nodesArray),
      edges: new DataSet(edgesArray)
    };

    const options = {
      physics: false, // Desactivamos físicas para fijar las posiciones X e Y simulando la red
      nodes: {
        font: { size: 14, face: 'Segoe UI', fontWeight: 'bold' },
        borderWidth: 2
      },
      edges: {
        smooth: { enabled: true, type: 'cubicBezier', roundness: 0.4 }
      }
    };

    // Renderizar la red en el DIV del HTML
    new Network(this.networkContainer.nativeElement, data, options);
  }

  volver() {
    this.router.navigate(['/']);
  }
}