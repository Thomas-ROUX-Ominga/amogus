import Link from "next/link";
import { Plus, Settings, Users } from "lucide-react";

export default function AdminBatchesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-[0.2em] text-primary font-orbitron">
              Batch Management
            </h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-2">
              Create and manage game batches for crew deployment
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/admin/tracker"
            className="group border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm hover:border-primary/40 transition-all"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full border border-primary/30 flex items-center justify-center bg-primary/5 group-hover:bg-primary/10 transition-colors">
                <Users className="text-primary w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold uppercase tracking-wider text-primary">
                Game Tracker
              </h3>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
              Monitor active game sessions and crew progress in real-time
            </p>
            <div className="mt-4 text-[8px] text-primary/50 uppercase tracking-widest">
              VIEW TRACKER →
            </div>
          </Link>

          <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm opacity-50">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full border border-primary/30 flex items-center justify-center bg-primary/5">
                <Plus className="text-primary w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold uppercase tracking-wider text-primary">
                Create Batch
              </h3>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
              Generate new game batches with custom configurations
            </p>
            <div className="mt-4 text-[8px] text-primary/50 uppercase tracking-widest">
              COMING SOON
            </div>
          </div>

          <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm opacity-50">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full border border-primary/30 flex items-center justify-center bg-primary/5">
                <Settings className="text-primary w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold uppercase tracking-wider text-primary">
                Batch Settings
              </h3>
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
              Configure batch parameters and deployment options
            </p>
            <div className="mt-4 text-[8px] text-primary/50 uppercase tracking-widest">
              COMING SOON
            </div>
          </div>
        </div>

        {/* Status Panel */}
        <div className="border-2 border-primary/20 p-6 bg-black/50 backdrop-blur-sm">
          <h3 className="text-lg font-bold uppercase tracking-wider text-primary mb-4">
            System Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px]">
            <div className="flex justify-between items-center p-3 border border-primary/10">
              <span className="text-muted-foreground uppercase tracking-widest">Auth System</span>
              <span className="text-primary uppercase tracking-widest">ONLINE</span>
            </div>
            <div className="flex justify-between items-center p-3 border border-primary/10">
              <span className="text-muted-foreground uppercase tracking-widest">Session Manager</span>
              <span className="text-primary uppercase tracking-widest">ACTIVE</span>
            </div>
            <div className="flex justify-between items-center p-3 border border-primary/10">
              <span className="text-muted-foreground uppercase tracking-widest">Security Level</span>
              <span className="text-primary uppercase tracking-widest">MAXIMUM</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
