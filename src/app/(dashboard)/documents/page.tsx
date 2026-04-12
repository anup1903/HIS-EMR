"use client";

import { useState, useEffect, useRef } from "react";
import { MedicalEmptyState } from "@/components/shared/medical-empty-state";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Upload, Download, Folder, Search, File, Image, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

function getFileIcon(type: string) {
  if (type?.includes("image")) return <Image className="h-4 w-4 text-green-600" />;
  if (type?.includes("pdf")) return <FileText className="h-4 w-4 text-red-600" />;
  if (type?.includes("spreadsheet") || type?.includes("excel")) return <FileSpreadsheet className="h-4 w-4 text-blue-600" />;
  return <File className="h-4 w-4 text-gray-600" />;
}

export default function DocumentManagementPage() {
  const [documents, setDocuments] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [patients, setPatients] = useState<{ id: string; mrn: string; firstName: string; lastName: string }[]>([]);
  const [uploadForm, setUploadForm] = useState({ patientId: "", title: "", type: "REPORT" });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data) => setDocuments(data.data || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (showUpload) fetch("/api/patients?limit=200").then((r) => r.json()).then((d) => setPatients(d.data || []));
  }, [showUpload]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    const formData = new FormData();
    formData.append("patientId", uploadForm.patientId);
    formData.append("title", uploadForm.title);
    formData.append("type", uploadForm.type);
    if (fileInputRef.current?.files?.[0]) formData.append("file", fileInputRef.current.files[0]);

    const res = await fetch("/api/documents", { method: "POST", body: formData });
    if (res.ok) {
      setShowUpload(false);
      setUploadForm({ patientId: "", title: "", type: "REPORT" });
      fetch("/api/documents").then((r) => r.json()).then((data) => setDocuments(data.data || []));
    }
    setUploading(false);
  };

  const categories = new Set(documents.map((d) => d.type as string));
  const filtered = documents.filter((d) => {
    const patientName = `${(d.patient as Record<string, string>)?.firstName || ""} ${(d.patient as Record<string, string>)?.lastName || ""}`;
    return `${patientName} ${d.title} ${d.type}`.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Document Management</h1>
            <p className="text-sm text-muted-foreground">Upload, search, and manage patient documents.</p>
          </div>
        </div>
        <Button onClick={() => setShowUpload(!showUpload)}>
          <Upload className="mr-2 h-4 w-4" />Upload Document
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Documents" value={documents.length} icon={FileText} accent="primary" />
        <StatsCard title="Categories" value={categories.size} icon={Folder} accent="info" />
        <StatsCard title="Reports" value={documents.filter((d) => d.type === "REPORT").length} icon={FileSpreadsheet} accent="warning" />
        <StatsCard title="Images/Scans" value={documents.filter((d) => d.type === "SCAN" || d.type === "IMAGE").length} icon={Image} accent="success" />
      </div>

      {/* Upload Form */}
      {showUpload && (
        <Card>
          <CardHeader><CardTitle>Upload Document</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Patient *</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={uploadForm.patientId} onChange={(e) => setUploadForm({ ...uploadForm, patientId: e.target.value })} required>
                    <option value="">Select Patient</option>
                    {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.mrn})</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Document Type *</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={uploadForm.type} onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}>
                    <option value="REPORT">Report</option><option value="LAB_RESULT">Lab Result</option><option value="RADIOLOGY">Radiology</option>
                    <option value="PRESCRIPTION">Prescription</option><option value="DISCHARGE_SUMMARY">Discharge Summary</option>
                    <option value="CONSENT">Consent Form</option><option value="INSURANCE">Insurance Document</option>
                    <option value="SCAN">Scan/Image</option><option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="space-y-1.5"><Label>Title *</Label><Input value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })} required placeholder="Document title..." /></div>
                <div className="space-y-1.5"><Label>File *</Label><Input type="file" ref={fileInputRef} required /></div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={uploading}>{uploading ? "Uploading..." : "Upload"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Documents Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <MedicalEmptyState
              illustration="inbox"
              title="No documents found"
              description="Upload a document or try a different search."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead className="text-[11px] uppercase tracking-wider w-10">Type</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Title</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Patient</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Category</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Uploaded By</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">Date</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((doc) => (
                  <TableRow key={doc.id as string} className="hover:bg-secondary/30 transition-colors">
                    <TableCell>{getFileIcon(doc.fileType as string || doc.type as string)}</TableCell>
                    <TableCell className="font-medium text-sm">{doc.title as string}</TableCell>
                    <TableCell>{(doc.patient as Record<string, string>)?.firstName} {(doc.patient as Record<string, string>)?.lastName}</TableCell>
                    <TableCell>
                      <Badge className="text-[10px] border-0 bg-info/10 text-info">
                        {(doc.type as string)?.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{doc.uploadedBy as string}</TableCell>
                    <TableCell className="tabular-nums">{new Date(doc.createdAt as string).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {doc.filePath ? (
                        <Button size="sm" variant="ghost" asChild>
                          <a href={doc.filePath as string} target="_blank" rel="noreferrer"><Download className="h-4 w-4" /></a>
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
