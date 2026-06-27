import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { TransporteService } from '../../services/transporte.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-inicio',
  imports: [ReactiveFormsModule],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio implements OnInit {
  matrizForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private transporteService: TransporteService
  ) { }

  ngOnInit(): void {
    this.initForm();
  }

  initForm() {
    this.matrizForm = this.fb.group({
      tiendas: this.fb.array([]),
      fabricas: this.fb.array([]),
      demandas: this.fb.array([])
    });
  }

  get tiendasFormArray() { return this.matrizForm.get('tiendas') as FormArray; }
  get fabricasFormArray() { return this.matrizForm.get('fabricas') as FormArray; }
  get demandasFormArray() { return this.matrizForm.get('demandas') as FormArray; }

  getCostosControls(fabrica: AbstractControl): AbstractControl[] {
    const costosArray = fabrica.get('costos') as FormArray;
    return costosArray ? costosArray.controls : [];
  }

  agregarTienda() {
    const codigoLetra = 65 + this.tiendasFormArray.length;
    const letraTienda = String.fromCharCode(codigoLetra);

    this.tiendasFormArray.push(this.fb.control(`Tienda ${letraTienda}`, Validators.required));
    this.fabricasFormArray.controls.forEach((fabrica) => {
      const costos = fabrica.get('costos') as FormArray;
      if (costos) {
        costos.push(this.fb.control(0, Validators.required));
      }
    });
    this.demandasFormArray.push(this.fb.control(0, Validators.required));
    this.matrizForm.updateValueAndValidity();
    this.cdr.detectChanges();
  }

  agregarFabrica() {
    const numeroSiguiente = this.fabricasFormArray.length + 1;
    const costosIniciales = this.tiendasFormArray.controls.map(() => this.fb.control(0, Validators.required));

    const nuevaFabrica = this.fb.group({
      nombre: [`Fábrica ${numeroSiguiente}`, Validators.required],
      costos: this.fb.array(costosIniciales),
      oferta: [0, Validators.required]
    });

    this.fabricasFormArray.push(nuevaFabrica);
    this.cdr.detectChanges();
  }

  reiniciarTabla() {
    this.tiendasFormArray.clear();
    this.fabricasFormArray.clear();
    this.demandasFormArray.clear();
    this.matrizForm.updateValueAndValidity();
    this.cdr.detectChanges();
  }

  irAGenerarGrafo() {
    // 1. Verificamos que el formulario sea válido (que no haya campos vacíos)
    if (this.matrizForm.invalid) {
      alert('Por favor, completa todos los campos de costos, ofertas y demandas antes de continuar.');
      return;
    }

    // 2. Enviamos el JSON con los datos al servicio compartido
    this.transporteService.guardarMatriz(this.matrizForm.value);

    // 3. Ahora sí, viajamos a la página del grafo
    this.router.navigate(['/grafo']);
  }

  eliminarFabrica() {
    if (this.fabricasFormArray.length > 0) {
      this.fabricasFormArray.removeAt(this.fabricasFormArray.length - 1);

      this.matrizForm.updateValueAndValidity();
      this.cdr.detectChanges();
    }
  }

  eliminarTienda() {
    if (this.tiendasFormArray.length > 0) {
      const indiceUltimo = this.tiendasFormArray.length - 1;
      this.tiendasFormArray.removeAt(indiceUltimo);
      this.fabricasFormArray.controls.forEach((fabrica) => {
        const costos = fabrica.get('costos') as FormArray;
        if (costos && costos.length > 0) {
          costos.removeAt(indiceUltimo);
        }
      });
      this.demandasFormArray.removeAt(indiceUltimo);
      this.matrizForm.updateValueAndValidity();
      this.cdr.detectChanges();
    }
  }
}