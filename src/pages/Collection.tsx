import { useEffect, useState } from 'react';
import { comicApi, profileApi } from '@/db/api';
import type { Comic, Profile } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, BookOpen, AlertTriangle, ChevronDown, ChevronRight, Grid3x3, List, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ComicForm from '@/components/ComicForm';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface GroupedComics {
  [title: string]: Comic[];
}

export default function Collection() {
  const [comics, setComics] = useState<Comic[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingComic, setEditingComic] = useState<Comic | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grouped' | 'grid'>('grouped');
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const loadComics = async () => {
    if (!user) return;
    
    try {
      const [comicsData, profileData] = await Promise.all([
        comicApi.getMyComics(),
        profileApi.getProfileById(user.id),
      ]);
      setComics(comicsData);
      setProfile(profileData);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load comics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComics();
  }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this comic?')) return;

    try {
      await comicApi.deleteComic(id);
      toast({
        title: 'Success',
        description: 'Comic deleted successfully',
      });
      loadComics();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete comic',
        variant: 'destructive',
      });
    }
  };

  const handleSuccess = () => {
    setIsDialogOpen(false);
    setEditingComic(null);
    loadComics();
  };

  const handleAddComic = async () => {
    if (!user) return;

    try {
      const canAdd = await profileApi.canAddComic(user.id);
      if (!canAdd) {
        toast({
          title: 'Storage Limit Reached',
          description: `You've reached your storage limit of ${profile?.comic_storage_limit || 0} comics. Upgrade to add more.`,
          variant: 'destructive',
        });
        return;
      }
      setIsDialogOpen(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to check storage limit',
        variant: 'destructive',
      });
    }
  };

  const getStoragePercentage = () => {
    if (!profile || profile.comic_storage_limit === -1) return 0;
    return (comics.length / profile.comic_storage_limit) * 100;
  };

  const isNearLimit = () => {
    const percentage = getStoragePercentage();
    return percentage >= 80 && percentage < 100;
  };

  const isAtLimit = () => {
    if (!profile || profile.comic_storage_limit === -1) return false;
    return comics.length >= profile.comic_storage_limit;
  };

  const groupComicsByTitle = (): GroupedComics => {
    const sorted = [...comics].sort((a, b) => {
      const titleA = (a.title || 'Untitled').toLowerCase();
      const titleB = (b.title || 'Untitled').toLowerCase();
      if (titleA < titleB) return -1;
      if (titleA > titleB) return 1;
      
      const issueA = parseInt(a.issue_number || '0', 10);
      const issueB = parseInt(b.issue_number || '0', 10);
      return issueA - issueB;
    });

    const grouped: GroupedComics = {};
    sorted.forEach(comic => {
      const title = comic.title || 'Untitled';
      if (!grouped[title]) {
        grouped[title] = [];
      }
      grouped[title].push(comic);
    });

    return grouped;
  };

  const toggleGroup = (title: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedGroups(newExpanded);
  };

  const handleExportCSV = () => {
    if (comics.length === 0) {
      toast({
        title: 'No Data',
        description: 'You have no comics to export',
        variant: 'destructive',
      });
      return;
    }

    const headers = ['Title', 'Issue Number', 'Publisher', 'Condition', 'Grade', 'Estimated Value', 'Notes'];
    const rows = comics.map(comic => [
      comic.title || '',
      comic.issue_number || '',
      comic.publisher || '',
      comic.condition || '',
      comic.grade?.toString() || '',
      comic.estimated_value?.toString() || '',
      comic.notes || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `comic-vault-collection-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Success',
      description: `Exported ${comics.length} comics to CSV`,
    });
  };

  const handleExportJSON = () => {
    if (comics.length === 0) {
      toast({
        title: 'No Data',
        description: 'You have no comics to export',
        variant: 'destructive',
      });
      return;
    }

    const exportData = comics.map(comic => ({
      title: comic.title,
      issue_number: comic.issue_number,
      publisher: comic.publisher,
      condition: comic.condition,
      grade: comic.grade,
      estimated_value: comic.estimated_value,
      notes: comic.notes,
    }));

    const jsonContent = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `comic-vault-collection-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Success',
      description: `Exported ${comics.length} comics to JSON`,
    });
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    try {
      const text = await file.text();
      let importedComics: Partial<Comic>[] = [];

      if (fileExtension === 'json') {
        importedComics = JSON.parse(text);
      } else if (fileExtension === 'csv') {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          throw new Error('CSV file is empty or invalid');
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        
        for (let i = 1; i < lines.length; i++) {
          const values: string[] = [];
          let currentValue = '';
          let insideQuotes = false;

          for (let char of lines[i]) {
            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
              values.push(currentValue.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

          const comic: Partial<Comic> = {};
          headers.forEach((header, index) => {
            const value = values[index] || '';
            switch (header.toLowerCase()) {
              case 'title':
                comic.title = value;
                break;
              case 'issue number':
              case 'issue_number':
                comic.issue_number = value;
                break;
              case 'publisher':
                comic.publisher = value;
                break;
              case 'condition':
                comic.condition = value as any;
                break;
              case 'grade':
                comic.grade = value ? parseFloat(value) : undefined;
                break;
              case 'estimated value':
              case 'estimated_value':
                comic.estimated_value = value ? parseFloat(value) : undefined;
                break;
              case 'notes':
                comic.notes = value;
                break;
            }
          });

          if (comic.title) {
            importedComics.push(comic);
          }
        }
      } else {
        throw new Error('Unsupported file format. Please use CSV or JSON.');
      }

      if (importedComics.length === 0) {
        throw new Error('No valid comics found in the file');
      }

      if (profile && profile.comic_storage_limit !== -1) {
        const availableSpace = profile.comic_storage_limit - comics.length;
        if (importedComics.length > availableSpace) {
          toast({
            title: 'Storage Limit',
            description: `You can only import ${availableSpace} more comics. Upgrade to increase your limit.`,
            variant: 'destructive',
          });
          return;
        }
      }

      let successCount = 0;
      let errorCount = 0;

      for (const comic of importedComics) {
        try {
          await comicApi.createComic({
            ...comic,
            user_id: user!.id,
          } as Omit<Comic, 'id' | 'created_at' | 'updated_at'>);
          successCount++;
        } catch (error) {
          errorCount++;
          console.error('Failed to import comic:', comic.title, error);
        }
      }

      toast({
        title: 'Import Complete',
        description: `Successfully imported ${successCount} comics${errorCount > 0 ? `, ${errorCount} failed` : ''}`,
      });

      loadComics();
    } catch (error: any) {
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import comics',
        variant: 'destructive',
      });
    }

    event.target.value = '';
  };

  const expandAll = () => {
    const allTitles = Object.keys(groupComicsByTitle());
    setExpandedGroups(new Set(allTitles));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your collection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {(isNearLimit() || isAtLimit()) && (
        <Card className={`border-2 ${isAtLimit() ? 'border-destructive bg-destructive/5' : 'border-accent bg-accent/5'}`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className={`h-6 w-6 shrink-0 mt-1 ${isAtLimit() ? 'text-destructive' : 'text-accent'}`} />
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">
                  {isAtLimit() ? 'Storage Limit Reached' : 'Approaching Storage Limit'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {isAtLimit() 
                    ? `You've reached your storage limit of ${profile?.comic_storage_limit} comics. Upgrade to add more to your collection.`
                    : `You're using ${comics.length} of ${profile?.comic_storage_limit} comics (${getStoragePercentage().toFixed(0)}%). Consider upgrading for more storage.`
                  }
                </p>
                <Button onClick={() => navigate('/subscription')} size="sm">
                  View Plans
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Collection</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted-foreground">
              {comics.length} {comics.length === 1 ? 'comic' : 'comics'} in your vault
            </p>
            {profile && profile.comic_storage_limit !== -1 && (
              <Badge variant="secondary">
                {comics.length} / {profile.comic_storage_limit} used
              </Badge>
            )}
            {profile?.subscription_tier === 'pro' && (
              <Badge variant="default">Unlimited Storage</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {comics.length > 0 && (
            <>
              <div className="flex items-center gap-1 border rounded-lg p-1">
                <Button
                  variant={viewMode === 'grouped' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grouped')}
                >
                  <List className="h-4 w-4 mr-1" />
                  Grouped
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                >
                  <Grid3x3 className="h-4 w-4 mr-1" />
                  Grid
                </Button>
              </div>
              <div className="flex items-center gap-1 border rounded-lg p-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportCSV}
                  title="Export as CSV"
                >
                  <Download className="h-4 w-4 mr-1" />
                  CSV
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportJSON}
                  title="Export as JSON"
                >
                  <Download className="h-4 w-4 mr-1" />
                  JSON
                </Button>
              </div>
            </>
          )}
          <label htmlFor="import-file" className="cursor-pointer">
            <input
              id="import-file"
              type="file"
              accept=".csv,.json"
              onChange={handleImport}
              className="hidden"
            />
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </span>
            </Button>
          </label>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingComic(null);
          }}>
            <Button onClick={handleAddComic} disabled={isAtLimit()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Comic
            </Button>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingComic ? 'Edit Comic' : 'Add New Comic'}</DialogTitle>
              </DialogHeader>
              <ComicForm comic={editingComic} onSuccess={handleSuccess} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {viewMode === 'grouped' && comics.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      )}

      {comics.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No comics yet</h3>
            <p className="text-muted-foreground mb-4">
              Start building your collection by adding your first comic
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Comic
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'grouped' ? (
        <div className="space-y-4">
          {Object.entries(groupComicsByTitle()).map(([title, groupComics]) => {
            const isExpanded = expandedGroups.has(title);
            return (
              <Card key={title} className="overflow-hidden">
                <button
                  onClick={() => toggleGroup(title)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-primary" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <Badge variant="secondary">{groupComics.length} {groupComics.length === 1 ? 'issue' : 'issues'}</Badge>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t">
                    <div className="p-4 space-y-3">
                      {groupComics.map((comic) => (
                        <div
                          key={comic.id}
                          className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                        >
                          {comic.cover_image_url ? (
                            <img
                              src={comic.cover_image_url}
                              alt={comic.title}
                              className="w-16 h-24 object-cover rounded"
                            />
                          ) : (
                            <div className="w-16 h-24 bg-muted flex items-center justify-center rounded">
                              <BookOpen className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium">Issue #{comic.issue_number || '?'}</p>
                                <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                                  {comic.publisher && <span>{comic.publisher}</span>}
                                  {comic.publish_year && <span>{comic.publish_year}</span>}
                                  {comic.condition && <span className="text-foreground">Condition: {comic.condition}</span>}
                                </div>
                                <div className="flex flex-wrap gap-3 mt-1">
                                  {comic.grade && (
                                    <Badge variant="default">Grade: {comic.grade}/10</Badge>
                                  )}
                                  {comic.estimated_value && (
                                    <Badge variant="secondary">Value: ${comic.estimated_value.toFixed(2)}</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingComic(comic);
                                    setIsDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(comic.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          {comics.map((comic) => (
            <Card key={comic.id} className="comic-card overflow-hidden">
              <CardHeader className="p-0">
                {comic.cover_image_url ? (
                  <img
                    src={comic.cover_image_url}
                    alt={comic.title}
                    className="w-full h-64 object-cover"
                  />
                ) : (
                  <div className="w-full h-64 bg-muted flex items-center justify-center">
                    <BookOpen className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-4">
                <CardTitle className="text-lg mb-2 line-clamp-1">{comic.title}</CardTitle>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {comic.issue_number && <p>Issue #{comic.issue_number}</p>}
                  {comic.publisher && <p>{comic.publisher}</p>}
                  {comic.publish_year && <p>{comic.publish_year}</p>}
                  {comic.condition && (
                    <p className="text-foreground font-medium">Condition: {comic.condition}</p>
                  )}
                  {comic.grade && (
                    <p className="text-accent font-bold">Grade: {comic.grade}/10</p>
                  )}
                  {comic.estimated_value && (
                    <p className="text-secondary font-bold">
                      Value: ${comic.estimated_value.toFixed(2)}
                    </p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="p-4 pt-0 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setEditingComic(comic);
                    setIsDialogOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(comic.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
