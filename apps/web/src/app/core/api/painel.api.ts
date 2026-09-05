import { Injectable } from '@angular/core';
import type { DashboardAdminDto } from '@almativa/shared';
import { ApiBase } from './api.base';

@Injectable({ providedIn: 'root' })
export class PainelApi extends ApiBase {
  dashboard() {
    return this.http.get<DashboardAdminDto>(this.url('/painel/dashboard'));
  }
}
