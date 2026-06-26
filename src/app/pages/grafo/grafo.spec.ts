import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Grafo } from './grafo';

describe('Grafo', () => {
  let component: Grafo;
  let fixture: ComponentFixture<Grafo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Grafo]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Grafo);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
