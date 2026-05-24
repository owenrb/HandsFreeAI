import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: '', redirectTo: '/language-coach', pathMatch: 'full' },
    { 
        path: 'language-coach', 
        loadComponent: () => import('./language-coach/language-coach.component')
            .then(m =>  m.LanguageCoachComponent) 
    },
    {
        path: 'software-coach',
        loadComponent: () => import('./software-coach/software-coach.component')
            .then(m => m.SoftwareCoachComponent)
    },
    {
        path: 'agile-scrum-coach',
        loadComponent: () => import('./agile-scrum-coach/agile-scrum-coach.component')
            .then(m => m.AgileScrumCoachComponent)
    },
    { path: '**', redirectTo: '/language-coach', pathMatch: 'full' }
];
