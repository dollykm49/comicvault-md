import { useEffect, useState } from 'react';
import { marketplaceApi, comicApi } from '@/db/api';
import type { ListingWithComic, Comic } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { BookOpen, DollarSign, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function Marketplace() {
  const [listings, setListings] = useState<ListingWithComic[]>([]);
  const [myListings, setMyListings] = useState<ListingWithComic[]>([]);
  const [myComics, setMyComics] = useState<Comic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedComic, setSelectedComic] = useState('');
  const [price, setPrice] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  const loadData = async () => {
    try {
      const [allListings, userListings, comics] = await Promise.all([
        marketplaceApi.getActiveListings(),
        marketplaceApi.getMyListings(),
        comicApi.getMyComics(),
      ]);
      setListings(allListings);
      setMyListings(userListings);
      setMyComics(comics.filter(c => !userListings.some(l => l.comic_id === c.id && l.status === 'active')));
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load marketplace',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateListing = async () => {
    if (!selectedComic || !price) {
      toast({
        title: 'Error',
        description: 'Please select a comic and enter a price',
        variant: 'destructive',
      });
      return;
    }

    if (!user) return;

    try {
      await marketplaceApi.createListing({
        comic_id: selectedComic,
        seller_id: user.id,
        price: parseFloat(price),
      });
      toast({
        title: 'Success',
        description: 'Comic listed for sale',
      });
      setIsDialogOpen(false);
      setSelectedComic('');
      setPrice('');
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create listing',
        variant: 'destructive',
      });
    }
  };

  const handleCancelListing = async (id: string) => {
    if (!confirm('Cancel this listing?')) return;

    try {
      await marketplaceApi.updateListing(id, { status: 'cancelled' });
      toast({
        title: 'Success',
        description: 'Listing cancelled',
      });
      loadData();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel listing',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading marketplace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Marketplace</h1>
          <p className="text-muted-foreground mt-1">Buy and sell comics with other collectors</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              List Comic
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>List Comic for Sale</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Select Comic</Label>
                <Select value={selectedComic} onValueChange={setSelectedComic}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a comic from your collection" />
                  </SelectTrigger>
                  <SelectContent>
                    {myComics.map((comic) => (
                      <SelectItem key={comic.id} value={comic.id}>
                        {comic.title} {comic.issue_number && `#${comic.issue_number}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Enter price"
                />
              </div>
              <Button onClick={handleCreateListing} className="w-full">
                Create Listing
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="browse" className="w-full">
        <TabsList>
          <TabsTrigger value="browse">Browse Listings</TabsTrigger>
          <TabsTrigger value="my-listings">My Listings</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-6">
          {listings.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <BookOpen className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No listings available</h3>
                <p className="text-muted-foreground">Check back later for new comics</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
              {listings.map((listing) => (
                <Card key={listing.id} className="comic-card overflow-hidden">
                  <CardHeader className="p-0">
                    {listing.comic.cover_image_url ? (
                      <img
                        src={listing.comic.cover_image_url}
                        alt={listing.comic.title}
                        className="w-full h-64 object-cover"
                      />
                    ) : (
                      <div className="w-full h-64 bg-muted flex items-center justify-center">
                        <BookOpen className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="p-4">
                    <CardTitle className="text-lg mb-2 line-clamp-1">{listing.comic.title}</CardTitle>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {listing.comic.issue_number && <p>Issue #{listing.comic.issue_number}</p>}
                      {listing.comic.publisher && <p>{listing.comic.publisher}</p>}
                      {listing.comic.condition && <p>Condition: {listing.comic.condition}</p>}
                      {listing.comic.grade && <p>Grade: {listing.comic.grade}/10</p>}
                      <p className="text-secondary font-bold text-lg mt-2">
                        ${listing.price.toFixed(2)}
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="p-4 pt-0">
                    <Button className="w-full" disabled={listing.seller_id === user?.id}>
                      <DollarSign className="h-4 w-4 mr-2" />
                      {listing.seller_id === user?.id ? 'Your Listing' : 'Contact Seller'}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="my-listings" className="mt-6">
          {myListings.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <DollarSign className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">No active listings</h3>
                <p className="text-muted-foreground mb-4">Start selling comics from your collection</p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Listing
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
              {myListings.map((listing) => (
                <Card key={listing.id} className="comic-card overflow-hidden">
                  <CardHeader className="p-0">
                    {listing.comic.cover_image_url ? (
                      <img
                        src={listing.comic.cover_image_url}
                        alt={listing.comic.title}
                        className="w-full h-64 object-cover"
                      />
                    ) : (
                      <div className="w-full h-64 bg-muted flex items-center justify-center">
                        <BookOpen className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="p-4">
                    <CardTitle className="text-lg mb-2 line-clamp-1">{listing.comic.title}</CardTitle>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {listing.comic.issue_number && <p>Issue #{listing.comic.issue_number}</p>}
                      <p className="text-secondary font-bold text-lg mt-2">
                        ${listing.price.toFixed(2)}
                      </p>
                      <p className="text-xs">Status: {listing.status}</p>
                    </div>
                  </CardContent>
                  <CardFooter className="p-4 pt-0">
                    {listing.status === 'active' && (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => handleCancelListing(listing.id)}
                      >
                        Cancel Listing
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
