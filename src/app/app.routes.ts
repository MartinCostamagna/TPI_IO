import { Routes } from '@angular/router';
import { Inicio } from './pages/inicio/inicio';
import { Grafo } from './pages/grafo/grafo';

export const routes: Routes = [
    { path: '', pathMatch: 'full', redirectTo: 'inicio' },
    { path: 'inicio', component: Inicio },
    { path: 'grafo', component: Grafo },

];
