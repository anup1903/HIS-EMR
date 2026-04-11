"use client";

import { useState, useEffect, useRef } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatsCard } from "@/components/shared/stats-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Upload, Download, Folder, Search, File, Image, FileSpreadsheet } from "lucide-react";

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
    <div className="space-y-6">
      <PageHeader title="Document Management" description="Patient documents, reports, and file management">
        <Button onClick={() => setShowUpload(!showUpload)}><Upload className="mr-2 h-4 w-4" />Upload Document</Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard title="Total Documents" value={documents.length} icon={FileText} />
        <StatsCard title="Categories" value={categories.size} icon={Folder} />
        <StatsCard title="Reports" value={documents.filter((d) => d.type === "REPORT").length} icon={FileSpreadsheet} />
        <StatsCard title="Images/Scans" value={documents.filter((d) => d.type === "SCAN" || d.type === "IMAGE").length} icon={Image} />
      </div>

      {showUpload && (
        <Card>
          <CardHeader><CardTitle>Upload Document</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Patient *</Label>
                  <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={uploadForm.patientId} onChange={(e) => setUploadForm({ ...uploadForm, patientId: e.target.value })} required>
                    <option value="">Select Patient</option>
                    {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.mrn})</option>)}
                  </select>
                </div>
                <div>
                  <Label>Document Type *</Label>
                  <select className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" value={uploadForm.type} onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}>
                    <option value="REPORT">Report</option><option value="LAB_RESULT">Lab Result</option><option value="RADIOLOGY">Radiology</option>
                    <option value="PRESCRIPTION">Prescription</option><option value="DISCHARGE_SUMMARY">Discharge Summary</option>
                    <option value="CONSENT">Consent Form</option><option value="INSURANCE">Insurance Document</option>
                    <option value="SCAN">Scan/Image</option><option value="OTHER">Other</option>
                  </select>
                </div>
                <div><Label>Title *</Label><Input value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })} required placeholder="Document title..." /></div>
                <div><Label>File *</Label><Input type="file" ref={fileInputRef} required /></div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={uploading}>{uploading ? "Uploading..." : "Upload"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowUpload(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search documents..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Loading...</p> : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No documents found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((doc) => (
                  <TableRow key={doc.id as string}>
                    <TableCell>{getFileIcon(doc.fileType as string || doc.type as string)}</TableCell>
                    <TableCell className="font-medium">{doc.title as string}</TableCell>
                    <TableCell>{(doc.patient as Record<string, string>)?.firstName} {(doc.patient as Record<string, string>)?.lastName}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
                        {(doc.type as string)?.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell>{doc.uploadedBy as string}</TableCell>
                    <TableCell>{new Date(doc.createdAt as string).toLocaleDateString()}</TableCell>
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
