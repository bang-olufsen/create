# Product Identities

A *product identity* is a collection of information about a physical product, such as a loudspeaker. For example, all Bang & Olufsen models listed in Beocreate 2 have their own product identities. The system can "assume" an identity and appear as that product in certain places, such as the Product Information screen or Beocreate Connect application.

Product identities contain information such as model name, model identifier, manufacturer, designer, production years and a product image. Some of this information is shown in the sound preset preview dialogue.

To clarify, product identities are "superficial customisation features". They do not affect sound settings or other capabilities of the system at this time.

Product identities can exist standalone in `/etc/beocreate/beo-product-identities/` or they can be embedded within sound presets.

Currently it is not possible to import standalone product identities through the user interface.

## Data Format: JSON

Product identity files are JSON files. The following is a complete example of a product identity:

	{
		"modelID": "beovox-cx50",
		"modelName": "Beovox CX 50",
		"productImage": "beovox-cx50",
		"designer": "Jacob Jensen",
		"produced": [1984, 2003],
		"manufacturer": "Bang & Olufsen"
	}
	
## Supported Properties

Next, we will cover the supported properties that can be embedded in a product identity. Required properties are indicated as such, others are optional.

### Model ID

	"modelID": "beovox-cx50"

**Required.**

When a product identity is imported, the model ID (*modelID*) field becomes its identifier, which means that it must be unique. Product identities that are imported later will replace earlier identities that have the same model ID.

*Tip:* although file names are not important to the system, for clarity, it makes sense to use the same file name and model ID for product identity files.

### Model Name

	"modelName": "Beovox CX 50"
	
**Required.**

The human-readable model name of the product this identity represents. Shown in the product information screen and Beocreate Connect above the product name. Should be kept concise to avoid truncation in space-constrained contexts.

### Product Image

	"productImage": "beovox-cx50"
	
The name of the PNG image file used for this product. There are different ways to define it:

- *Name only:* shown in the example, this omits the file extension. The .png extensions is added automatically.
- *Name and extension:* contains the .png extension, otherwise the same as above.
- *URL:* a web address where this image can be downloaded.

In all cases, the system searches `/etc/beocreate/beo-product-images/` for a matching image file. When the image is defined as a URL, the system will use the last path component as the file name to search for the image locally.

If a matching image is not found in the image directory, a default image will be used. If the image is defined as a URL, the system will attempt to download the image from the internet.

Product image guidelines can be found in [Beocreate 2 Design Guidelines](Design Guidelines.md).

### Designer

	"designer": "Jacob Jensen"
	
Indicate the (industrial) designer of this product.

### Production Years

	"produced": [1984, 2003]
	
Indicates the years this product was in production.

- For a range of years, define this property as an array (as above)
- For a single year, define it as a number.

### Manufacturer

	"manufacturer": "Bang & Olufsen"
	
Manufacturer of the product. The system uses this to separate Bang & Olufsen sound presets from other presets in the user interface. Please do not abuse this field to misrepresent products.