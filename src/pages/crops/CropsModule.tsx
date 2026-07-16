import { EmptyState } from '@/components/UI';

export default function CropsModule() {
  return (
    <div>
      <div className="card mb-6" style={{ borderLeft: '4px solid var(--md-warning)', background: '#FFF8E1' }}>
        <div className="flex items-center gap-3">
          <span className="material-icons-outlined" style={{ fontSize: 32, color: 'var(--md-warning)' }}>construction</span>
          <div>
            <strong style={{ fontSize: 16 }}>Crops Module - In Progress</strong>
            <p className="text-muted" style={{ marginTop: 4 }}>
              This module is currently under development. It will support crop planning, planting, harvesting, 
              inventory tracking, and field management. Check back soon for updates.
            </p>
          </div>
        </div>
      </div>
      <EmptyState
        icon="grass"
        title="Coming Soon"
        description="The Crops module will be available in a future release. It will cover crop planning, field management, planting schedules, harvesting, and crop inventory."
      />
    </div>
  );
}
