import { useState, useEffect } from 'react';
import { db, nowISO, generateId } from '@/db/database';
import { useAuth } from '@/contexts/AuthContext';
import { useFarm } from '@/contexts/FarmContext';
import { useToast } from '@/components/ToastProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { Badge } from '@/components/UI';
import { FARM_ROLE_LABELS, type FarmMembership, type FarmRole } from '@/db/types';

export default function MembershipManagement() {
  const { authUser } = useAuth();
  const { currentFarmId } = useFarm();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [members, setMembers] = useState<FarmMembership[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FarmMembership[]>([]);
  const [tab, setTab] = useState<'active' | 'pending'>('active');
  const [editingMember, setEditingMember] = useState<FarmMembership | null>(null);
  const [newRole, setNewRole] = useState<FarmRole>('farm_staff');

  useEffect(() => {
    if (!currentFarmId) return;
    loadMembers();
  }, [currentFarmId]);

  async function loadMembers() {
    const all = await db.memberships.where({ farmId: currentFarmId }).toArray();
    setMembers(all.filter(m => m.status === 'active'));
    setPendingRequests(all.filter(m => m.status === 'pending'));
  }

  async function handleApprove(membership: FarmMembership, role: FarmRole) {
    if (!membership.id) return;
    const now = nowISO();
    await db.memberships.update(membership.id, {
      status: 'active', role, joinedDate: now, lastAccessedDate: now, updatedAt: now,
    });
    await db.notifications.add({
      farmId: currentFarmId, type: 'membership_approved',
      title: 'Request Approved',
      message: `Your request to join has been approved. You are now a ${FARM_ROLE_LABELS[role]}.`,
      targetEmail: membership.userEmail,
      fromUser: authUser?.displayName || '',
      fromEmail: authUser?.email || '',
      read: false, createdAt: now,
    });
    toast(`${membership.userName} approved as ${FARM_ROLE_LABELS[role]}`, 'success');
    await loadMembers();
  }

  async function handleReject(membership: FarmMembership, reason?: string) {
    if (!membership.id) return;
    const now = nowISO();
    await db.memberships.update(membership.id, {
      status: 'rejected', rejectionReason: reason || '', updatedAt: now,
    });
    await db.notifications.add({
      farmId: currentFarmId, type: 'membership_rejected',
      title: 'Request Rejected',
      message: reason ? `Your request was rejected: ${reason}` : 'Your request to join was not approved.',
      targetEmail: membership.userEmail,
      fromUser: authUser?.displayName || '',
      fromEmail: authUser?.email || '',
      read: false, createdAt: now,
    });
    toast('Request rejected');
    await loadMembers();
  }

  async function handleUpdateRole(membership: FarmMembership, role: FarmRole) {
    if (!membership.id) return;
    await db.memberships.update(membership.id, { role, updatedAt: nowISO() });
    toast(`${membership.userName}'s role updated to ${FARM_ROLE_LABELS[role]}`);
    setEditingMember(null);
    await loadMembers();
  }

  async function handleRemove(membership: FarmMembership) {
    if (!membership.id) return;
    await db.memberships.update(membership.id, { status: 'removed', updatedAt: nowISO() });
    toast(`${membership.userName} removed from farm`);
    await loadMembers();
  }

  async function handleSuspend(membership: FarmMembership) {
    if (!membership.id) return;
    await db.memberships.update(membership.id, { status: 'suspended', updatedAt: nowISO() });
    toast(`${membership.userName} suspended`);
    await loadMembers();
  }

  if (!hasPermission('members:view')) {
    return (
      <div className="empty-state">
        <span className="material-icons-outlined empty-icon">lock</span>
        <h3>Access Denied</h3>
        <p>You don't have permission to view members.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3>Team Members</h3>
      </div>

      <div className="tabs mb-3">
        <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
          Active ({members.length})
        </button>
        <button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
          Pending ({pendingRequests.length})
          {pendingRequests.length > 0 && <span className="tab-badge">{pendingRequests.length}</span>}
        </button>
      </div>

      {tab === 'pending' && (
        <div className="grid gap-3">
          {pendingRequests.length === 0 ? (
            <div className="empty-state">
              <span className="material-icons-outlined empty-icon">check_circle</span>
              <h3>No Pending Requests</h3>
            </div>
          ) : (
            pendingRequests.map(mem => (
              <PendingRequestCard
                key={mem.id}
                membership={mem}
                onApprove={(role) => handleApprove(mem, role)}
                onReject={() => handleReject(mem)}
              />
            ))
          )}
        </div>
      )}

      {tab === 'active' && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map(mem => (
                <tr key={mem.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      {mem.userPhoto ? (
                        <img src={mem.userPhoto} alt="" className="user-avatar" style={{ width: 32, height: 32 }} referrerPolicy="no-referrer" />
                      ) : (
                        <div className="user-avatar-placeholder" style={{ width: 32, height: 32, fontSize: 13 }}>{mem.userName.charAt(0).toUpperCase()}</div>
                      )}
                      <div>
                        <div style={{ fontWeight: 500 }}>{mem.userName}</div>
                        <div className="text-secondary text-sm">{mem.userEmail}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge variant={mem.role === 'owner' ? 'success' : mem.role === 'admin' ? 'info' : 'neutral'}>
                      {FARM_ROLE_LABELS[mem.role]}
                    </Badge>
                  </td>
                  <td className="text-secondary text-sm">{mem.joinedDate ? new Date(mem.joinedDate).toLocaleDateString() : '-'}</td>
                  <td className="text-secondary text-sm">{mem.lastAccessedDate ? new Date(mem.lastAccessedDate).toLocaleDateString() : '-'}</td>
                  <td>
                    {mem.role !== 'owner' && hasPermission('members:edit') && (
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-outline" onClick={() => { setEditingMember(mem); setNewRole(mem.role); }}>
                          Edit Role
                        </button>
                        <button className="btn btn-sm btn-danger-outline" onClick={() => handleRemove(mem)}>
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingMember && (
        <div className="modal-overlay" onClick={() => setEditingMember(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Role: {editingMember.userName}</h2>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Role</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value as FarmRole)}>
                  {Object.entries(FARM_ROLE_LABELS).filter(([k]) => k !== 'owner').map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <p className="text-secondary text-sm">
                Permissions will be updated immediately for this user.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditingMember(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => handleUpdateRole(editingMember, newRole)}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PendingRequestCard({ membership, onApprove, onReject }: {
  membership: FarmMembership;
  onApprove: (role: FarmRole) => void;
  onReject: () => void;
}) {
  const [role, setRole] = useState<FarmRole>('farm_staff');
  const [showApprove, setShowApprove] = useState(false);

  return (
    <div className="card">
      <div className="card-body">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {membership.userPhoto ? (
              <img src={membership.userPhoto} alt="" className="user-avatar" referrerPolicy="no-referrer" />
            ) : (
              <div className="user-avatar-placeholder">{membership.userName.charAt(0).toUpperCase()}</div>
            )}
            <div>
              <div style={{ fontWeight: 600 }}>{membership.userName}</div>
              <div className="text-secondary text-sm">{membership.userEmail}</div>
              <div className="text-secondary text-sm">Requested {new Date(membership.createdAt).toLocaleDateString()}</div>
            </div>
          </div>
          <Badge variant="warning">Pending</Badge>
        </div>
        {membership.requestMessage && (
          <div className="mt-2 text-sm" style={{ fontStyle: 'italic', color: 'var(--md-on-surface-variant)' }}>
            "{membership.requestMessage}"
          </div>
        )}
        {!showApprove ? (
          <div className="flex gap-2 mt-3">
            <button className="btn btn-sm btn-primary" onClick={() => setShowApprove(true)}>Approve</button>
            <button className="btn btn-sm btn-danger-outline" onClick={onReject}>Reject</button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-3">
            <select value={role} onChange={e => setRole(e.target.value as FarmRole)} className="btn btn-sm btn-outline">
              {Object.entries(FARM_ROLE_LABELS).filter(([k]) => k !== 'owner').map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <button className="btn btn-sm btn-primary" onClick={() => onApprove(role)}>Confirm</button>
            <button className="btn btn-sm btn-outline" onClick={() => setShowApprove(false)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
