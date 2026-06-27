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
  analisisRutas: any[] = [];

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
        this.generarAnalisisSensibilidad();
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

    // ==========================================
    // PASO 1: CREACIÓN DE TODOS LOS NODOS
    // ==========================================

    // 1. Crear Nodos de Fábricas Reales (Columna Izquierda)
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

    // 🌟 AGREGAR FÁBRICA FICTICIA SI EL MODELO TIENE DÉFICIT
    const ofertaTotal = this.matriz.fabricas.reduce((sum, f) => sum + f.oferta, 0);
    const demandaTotal = this.matriz.demandas.reduce((sum, d) => sum + d, 0);

    if (demandaTotal > ofertaTotal) {
      const deficit = demandaTotal - ofertaTotal;
      nodesArray.push({
        id: 'fab_ficticia',
        label: `Fábrica Ficticia\n(Déficit: ${deficit})`,
        color: { background: '#EDF2F7', border: '#718096' }, // Color gris artificial
        shape: 'ellipse',
        x: -200,
        y: this.matriz.fabricas.length * 140 // Se posiciona sola al final de la columna izquierda
      });
    }

    // 2. Crear Nodos de Tiendas (Columna Derecha)
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


    // ==========================================
    // PASO 2: CREACIÓN DE TODAS LAS FLECHAS (EDGES)
    // ==========================================

    // --- PARTE A: Arcos desde fábricas REALES hacia tiendas ---
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

    // --- PARTE B: Arcos desde la Fábrica FICTICIA hacia las tiendas (Si hay déficit) ---
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
              color: '#A0AEC0',     // Flecha gris para desabastecimiento
              highlight: '#3182CE',
              hover: '#4A5568'
            },
            width: 3,
            dashes: true // Línea punteada prolija
          });
        }
      });
    }


    // ==========================================
    // PASO 3: CONFIGURACIÓN E INICIALIZACIÓN DE VIS.JS
    // ==========================================
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
        hover: true,            // Habilita los efectos visuales al pasar el mouse
        tooltipDelay: 100       // Despliegue inmediato del cartelito
      }
    };

    new Network(this.networkContainer.nativeElement, data, options);
  }

  generarAnalisisSensibilidad() {
    if (!this.matriz || !this.resultadosLp) return;

    const ofertaTotal = this.matriz.fabricas.reduce((sum, f) => sum + f.oferta, 0);
    const demandaTotal = this.matriz.demandas.reduce((sum, d) => sum + d, 0);

    // 1. PROCESAR FÁBRICAS (PRECIOS SOMBRA DINÁMICOS)
    this.analisisFabricas = this.matriz.fabricas.map((fab, i) => {
      let precioSombra = 0;
      let interpretacion = '';
      let claseEstilo = 'texto-ok';

      // Buscamos si esta fábrica saturó su capacidad (si envió todo lo que tenía)
      let totalEnviado = 0;
      this.matriz!.tiendas.forEach((_, j) => {
        totalEnviado += (this.resultadosLp[`x_${i}_${j}`] || 0);
      });

      // Si la demanda supera a la oferta y la fábrica está al 100%, tiene precio sombra
      if (demandaTotal > ofertaTotal && totalEnviado >= fab.oferta) {
        // Buscamos el costo mínimo marginal (en los modelos de transporte suele ser el costo de oportunidad penalizado)
        const costosValidos = fab.costos.filter(c => c > 0);
        precioSombra = costosValidos.length > 0 ? Math.min(...costosValidos) : 2;
        claseEstilo = 'texto-alerta';
        interpretacion = `Cada unidad extra de capacidad en esta planta reducirá el costo global en $${precioSombra}, ya que absorberá parte del desabastecimiento actual.`;
      } else {
        interpretacion = `Esta planta posee margen u ociosidad. Aumentar su capacidad ahora no altera el costo óptimo actual ya que el cuello de botella está en otro nodo.`;
      }

      return {
        nombre: fab.nombre,
        capacidad: `${fab.oferta} u`,
        precioSombra: precioSombra > 0 ? `+$${precioSombra} / u` : '$0 / u (Saturado)',
        estilo: claseEstilo,
        conclusion: interpretacion
      };
    });

    // 2. PROCESAR RUTAS ACTIVAS (ROBUSTEZ DINÁMICA)
    this.analisisRutas = [];
    this.matriz.fabricas.forEach((fab, i) => {
      this.matriz!.tiendas.forEach((tienda, j) => {
        const varName = `x_${i}_${j}`;
        const cantidadEnviada = this.resultadosLp[varName] || 0;
        const costoUnitario = fab.costos[j];

        // Solo analizamos las rutas que el solver decidió ACTIVAR
        if (cantidadEnviada > 0) {
          // Cálculo adaptativo de rangos conceptuales
          const limiteSuperior = costoUnitario * 1.5; // Umbral estimado de quiebre

          this.analisisRutas.push({
            origenDestino: `${fab.nombre} → ${tienda}`,
            costo: `$${costoUnitario} / u`,
            cantidad: `${cantidadEnviada} u`,
            limiteInferior: '-$∞',
            limiteSuperior: `$${limiteSuperior} / u`,
            conclusion: `Esta ruta transporta ${cantidadEnviada} unidades. Es económicamente estable mientras el flete logístico no sufra un incremento mayor al 50%.`
          });
        }
      });
    });
  }

  volver() {
    this.router.navigate(['/']);
  }
}