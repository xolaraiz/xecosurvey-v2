import { SolarSurveyProject, UserRole, WorkflowStatus } from '../types/survey';

export const ROLE_LABELS: Record<UserRole, string> = {
  master_admin: 'Master Admin (สำนักงานใหญ่)',
  franchise_admin: 'Franchise Admin (ผู้ดูแลสาขา)',
  surveyor: 'Surveyor / Technician (ผู้สำรวจภาคสนาม)',
  electrical_engineer: 'Electrical Engineer (วิศวกรไฟฟ้าตรวจทาน)',
  qa_manager: 'Project / QA Manager (ผู้จัดการคุณภาพ)',
  sales_consultant: 'Sales / Consultant (ที่ปรึกษาการขาย)',
  customer_viewer: 'Customer Viewer (ลูกค้าดูรายงาน)',
};

export interface RolePermissions {
  canViewCrossFranchise: boolean;
  canManageStandards: boolean;
  canCreateProject: boolean;
  canEditSurveyFields: boolean;
  canEditHazards: boolean;
  canSubmitForReview: boolean;
  canPerformEngineeringReview: boolean;
  canIssueReport: boolean;
  canViewTechnicalReport: boolean;
  canViewCustomerReport: boolean;
  canExportOrDeleteData: boolean;
  canUseAiAssistant: boolean;
}

export function getRolePermissions(role: UserRole): RolePermissions {
  switch (role) {
    case 'master_admin':
      return {
        canViewCrossFranchise: true,
        canManageStandards: true,
        canCreateProject: true,
        canEditSurveyFields: true,
        canEditHazards: true,
        canSubmitForReview: true,
        canPerformEngineeringReview: true,
        canIssueReport: true,
        canViewTechnicalReport: true,
        canViewCustomerReport: true,
        canExportOrDeleteData: true,
        canUseAiAssistant: true,
      };
    case 'franchise_admin':
      return {
        canViewCrossFranchise: false,
        canManageStandards: false,
        canCreateProject: true,
        canEditSurveyFields: true,
        canEditHazards: true,
        canSubmitForReview: true,
        canPerformEngineeringReview: false,
        canIssueReport: true,
        canViewTechnicalReport: true,
        canViewCustomerReport: true,
        canExportOrDeleteData: true,
        canUseAiAssistant: true,
      };
    case 'surveyor':
      return {
        canViewCrossFranchise: false,
        canManageStandards: false,
        canCreateProject: true,
        canEditSurveyFields: true,
        canEditHazards: true,
        canSubmitForReview: true,
        canPerformEngineeringReview: false,
        canIssueReport: false,
        canViewTechnicalReport: true,
        canViewCustomerReport: true,
        canExportOrDeleteData: false,
        canUseAiAssistant: true,
      };
    case 'electrical_engineer':
      return {
        canViewCrossFranchise: false,
        canManageStandards: false,
        canCreateProject: false,
        canEditSurveyFields: true,
        canEditHazards: true,
        canSubmitForReview: false,
        canPerformEngineeringReview: true,
        canIssueReport: true,
        canViewTechnicalReport: true,
        canViewCustomerReport: true,
        canExportOrDeleteData: false,
        canUseAiAssistant: true,
      };
    case 'qa_manager':
      return {
        canViewCrossFranchise: false,
        canManageStandards: false,
        canCreateProject: false,
        canEditSurveyFields: false,
        canEditHazards: true,
        canSubmitForReview: false,
        canPerformEngineeringReview: false,
        canIssueReport: true,
        canViewTechnicalReport: true,
        canViewCustomerReport: true,
        canExportOrDeleteData: true,
        canUseAiAssistant: true,
      };
    case 'sales_consultant':
      return {
        canViewCrossFranchise: false,
        canManageStandards: false,
        canCreateProject: true,
        canEditSurveyFields: false,
        canEditHazards: false,
        canSubmitForReview: false,
        canPerformEngineeringReview: false,
        canIssueReport: false,
        canViewTechnicalReport: false,
        canViewCustomerReport: true,
        canExportOrDeleteData: false,
        canUseAiAssistant: false,
      };
    case 'customer_viewer':
      return {
        canViewCrossFranchise: false,
        canManageStandards: false,
        canCreateProject: false,
        canEditSurveyFields: false,
        canEditHazards: false,
        canSubmitForReview: false,
        canPerformEngineeringReview: false,
        canIssueReport: false,
        canViewTechnicalReport: false,
        canViewCustomerReport: true,
        canExportOrDeleteData: false,
        canUseAiAssistant: false,
      };
  }
}

export function filterProjectsForContext(
  projects: SolarSurveyProject[],
  activeFranchiseId: string,
  role: UserRole
): SolarSurveyProject[] {
  const perms = getRolePermissions(role);
  return projects.filter((p) => {
    const tenantAllowed = perms.canViewCrossFranchise
      ? activeFranchiseId === 'ALL' || p.franchiseId === activeFranchiseId
      : p.franchiseId === activeFranchiseId;
    if (!tenantAllowed) return false;
    if (role === 'customer_viewer') {
      return p.status === 'Report Issued';
    }
    return true;
  });
}

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  Draft: 'ร่างเอกสาร (Draft)',
  Assigned: 'มอบหมายแล้ว (Assigned)',
  'Survey In Progress': 'กำลังสำรวจหน้างาน',
  Submitted: 'ส่งผลสำรวจแล้ว',
  'Engineering Review': 'รอวิศวกรตรวจทาน',
  'Revision Required': 'ต้องแก้ไขเพิ่มเติม',
  Reviewed: 'วิศวกรตรวจทานแล้ว',
  'Report Issued': 'ออกรายงานแล้ว',
  Archived: 'จัดเก็บถาวร',
};
