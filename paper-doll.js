const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

console.log('¡Eldara Paper Doll Cargado!');

export class EldaraPaperDoll extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(actor, options = {}) {
        super(options);
        this.actor = actor;

        // Mapa de validación de tipos por ranura
        this.VALIDATION_MAP = {
            "1": ['arma_melee', 'arma_distancia'], // Excepción para 'Desarmado' implementada en código
            "2": ['arma_melee', 'arma_distancia', 'escudo'],
            "3": ['armadura'],
            "4": ['conducto'],
            "5": ['conducto'],
            "6": ['casco'],
            "7": ['guantes'],
            "8": ['calzado'],
            "9": ['consumible', 'utilidad'],
            "10": ['consumible', 'utilidad']
        };

        this._debouncedRender = foundry.utils.debounce(() => this.render(false), 100);

        this._hookIds = {
            updateItem: Hooks.on("updateItem", (item) => this._onItemUpdate(item)),
            createItem: Hooks.on("createItem", (item) => this._onItemUpdate(item)),
            deleteItem: Hooks.on("deleteItem", (item) => this._onItemUpdate(item)),
            closeV1: Hooks.on("closeActorSheet", (sheet) => this._onSheetClose(sheet)),
            closeV2: Hooks.on("closeApplicationV2", (app) => this._onSheetClose(app))
        };
    }

    _onItemUpdate(item) {
        if (item.parent?.id === this.actor.id) {
            this._debouncedRender();
        }
    }

    _onSheetClose(sheet) {
        // En V1 la hoja es el objeto 'sheet', en V2 es la instancia 'app'
        const closedActorId = (sheet.document || sheet.actor)?.id;
        if (closedActorId === this.actor.id) {
            this.close();
        }
    }

    async close(options = {}) {
        Hooks.off("updateItem", this._hookIds.updateItem);
        Hooks.off("createItem", this._hookIds.createItem);
        Hooks.off("deleteItem", this._hookIds.deleteItem);
        Hooks.off("closeActorSheet", this._hookIds.closeV1);
        Hooks.off("closeApplicationV2", this._hookIds.closeV2);
        return super.close(options);
    }

    static DEFAULT_OPTIONS = {
        id: "eldara-paper-doll",
        classes: ["eldara-paper-doll"],
        window: {
            title: "Paper Doll - Eldara",
            resizable: true,
            frame: true,
            positioned: true,
            icon: "fas fa-shield-alt"
        },
        position: {
            width: 420,
            height: 650
        }
    };

    static PARTS = {
        doll: {
            template: "modules/eldara-paper-doll/paper-doll.html"
        }
    };

    /** @override */
    _preFirstRender(context, options) {
        super._preFirstRender(context, options);

        // 1. Buscar en el nuevo gestor de V2
        let sheet = Array.from(foundry.applications.instances.values()).find(app => app.document?.id === this.actor.id && app.id !== this.id);

        // 2. Fallback al gestor de V1 (Legacy)
        if (!sheet) {
            sheet = Object.values(ui.windows).find(w => w.actor?.id === this.actor.id && w.id !== this.id);
        }

        if (sheet && sheet.position) {
            const pos = sheet.position;
            options.position = options.position || {};
            options.position.left = pos.left + pos.width + 10;
            options.position.top = pos.top;
        }
    }

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);
        // Eventos nativos de arrastre y clic
        const html = this.element;
        const slots = html.querySelectorAll('.item-slot');
        slots.forEach(slot => {
            slot.addEventListener('drop', this._onDrop.bind(this));
            slot.addEventListener('dragover', this._onDragOver.bind(this));
            slot.addEventListener('dragleave', this._onDragLeave.bind(this));
            slot.addEventListener('contextmenu', this._onRightClick.bind(this));
        });
    }

    _onDragOver(event) {
        event.preventDefault();
        event.currentTarget.classList.add('dragover');
    }

    _onDragLeave(event) {
        event.preventDefault();
        event.currentTarget.classList.remove('dragover');
    }

    async _onRightClick(event) {
        event.preventDefault();
        const slotElement = event.currentTarget;
        const slotId = slotElement.dataset.slotId;

        if (!slotId) return;

        let updates = [];
        const item = this.actor.items.find(i => i.system?.props?.ubicacion_item === slotId);

        if (item) {
            updates.push({ _id: item.id, "system.props.ubicacion_item": "0" });
        } else if (slotId === "2") {
            const itemSlot1 = this.actor.items.find(i => i.system?.props?.ubicacion_item === "1");
            if (itemSlot1 && itemSlot1.system?.props?.['manos_arma'] == '2') {
                updates.push({ _id: itemSlot1.id, "system.props.ubicacion_item": "0" });
            }
        }

        if (updates.length > 0) {
            this._applyUnarmedLogic(updates);
            await this.actor.updateEmbeddedDocuments("Item", updates);
            ui.notifications.info(`Eldara: Ítem desequipado.`);
        }
    }

    _applyUnarmedLogic(updates) {
        let slot1WillHaveItem = false;

        if (updates.some(u => u["system.props.ubicacion_item"] === "1")) {
            slot1WillHaveItem = true;
        } else {
            const currentSlot1Item = this.actor.items.find(i => i.system?.props?.ubicacion_item === "1");
            if (currentSlot1Item) {
                const updateForSlot1Item = updates.find(u => u._id === currentSlot1Item.id);
                if (!updateForSlot1Item || updateForSlot1Item["system.props.ubicacion_item"] === "1") {
                    slot1WillHaveItem = true;
                }
            }
        }

        if (!slot1WillHaveItem) {
            const desarmadoItem = this.actor.items.find(i => i.name === "Desarmado");
            if (desarmadoItem) {
                const updateForDesarmado = updates.find(u => u._id === desarmadoItem.id);
                if (updateForDesarmado) {
                    updateForDesarmado["system.props.ubicacion_item"] = "1";
                } else if (desarmadoItem.system?.props?.ubicacion_item !== "1") {
                    updates.push({ _id: desarmadoItem.id, "system.props.ubicacion_item": "1" });
                    ui.notifications.info("Modo 'Desarmado' activado automáticamente.");
                }
            }
        }
    }

    async _prepareContext(options) {
        const actor = this.actor;
        const equippedItems = actor.items.filter(i => {
            const ubicacion = i.system?.props?.ubicacion_item;
            return ubicacion && ubicacion > "0";
        });

        const slotsMap = {};
        equippedItems.forEach(i => {
            slotsMap[i.system.props.ubicacion_item] = i;
        });

        // Comprobación de Arma a 2 manos
        let twoHandedWeapon = null;
        const itemSlot1 = slotsMap["1"];
        if (itemSlot1 && itemSlot1.system?.props?.['manos_arma'] == '2') {
            twoHandedWeapon = {
                img: itemSlot1.img,
                name: itemSlot1.name
            };
        }

        const slotConfig = [
            { id: "6", name: "Casco" },
            { id: "3", name: "Armadura" },
            { id: "7", name: "Guantes" },
            { id: "1", name: "Mano Principal" },
            { id: "2", name: "Mano Secundaria" },
            { id: "9", name: "Cinturón" },
            { id: "10", name: "Cinturón" },
            { id: "8", name: "Calzado" },
            { id: "4", name: "Conducto 1" },
            { id: "5", name: "Conducto 2" }
        ];

        // Procesar la ranura 2 (Fantasma)
        if (twoHandedWeapon) {
            const slot2 = slotConfig.find(s => s.id === "2");
            if (slot2) {
                slot2.isTwoHandedPlaceholder = true;
                slot2.placeholderImg = twoHandedWeapon.img;
                slot2.placeholderName = twoHandedWeapon.name;
            }
        }

        return {
            actor: actor,
            slots: slotsMap,
            slotConfig: slotConfig
        };
    }

    async _onDrop(event) {
        try {
            event.preventDefault();
            event.currentTarget.classList.remove('dragover');

            const data = JSON.parse(event.dataTransfer.getData('text/plain'));
            if (data.type !== "Item") return;

            let item;
            if (data.uuid) {
                item = await fromUuid(data.uuid);
            } else {
                const itemId = data.id || data._id;
                item = this.actor.items.get(itemId);
            }

            if (!item || (item.actor?.id !== this.actor.id)) {
                ui.notifications.warn("Eldara: Solo puedes equipar ítems que ya estén en tu inventario.");
                return;
            }

            const slotElement = event.currentTarget;
            const slotId = slotElement?.dataset.slotId;

            if (!slotId) return;

            // Validación de tipos de CSB
            const tipoItem = item.system?.props?.tipo_item;
            const validTypes = this.VALIDATION_MAP[slotId];

            let isValid = false;
            if (validTypes && validTypes.includes(tipoItem)) {
                isValid = true;
            } else if (slotId === "1" && item.name === "Desarmado") {
                isValid = true;
            }

            if (!isValid) {
                ui.notifications.warn(`Eldara: No puedes equipar un ítem de tipo '${tipoItem || 'Desconocido'}' en esta ranura.`);
                return;
            }

            // Detección de arma a 2 manos
            const is2Handed = item.system?.props?.['manos_arma'] == '2';
            const currentItemSlot1 = this.actor.items.find(i => i.system?.props?.ubicacion_item === "1");

            // Bloqueo de ranura 2
            if (slotId === "2" && currentItemSlot1?.system?.props?.['manos_arma'] == '2') {
                ui.notifications.warn("Eldara: Tienes un arma a 2 manos equipada. La mano secundaria está ocupada.");
                return;
            }

            const updates = [];

            // Lógica de Swapping general
            const oldItem = this.actor.items.find(i => i.system?.props?.ubicacion_item === slotId);
            if (oldItem && oldItem.id !== item.id) {
                updates.push({ _id: oldItem.id, "system.props.ubicacion_item": "0" });
            }

            if ((slotId === "1" || slotId === "2") && is2Handed) {
                // Swapping profundo para arma a 2 manos
                const oldSlot1 = this.actor.items.find(i => i.system?.props?.ubicacion_item === "1");
                const oldSlot2 = this.actor.items.find(i => i.system?.props?.ubicacion_item === "2");

                if (oldSlot1 && oldSlot1.id !== item.id && !updates.some(u => u._id === oldSlot1.id)) {
                    updates.push({ _id: oldSlot1.id, "system.props.ubicacion_item": "0" });
                }
                if (oldSlot2 && oldSlot2.id !== item.id && !updates.some(u => u._id === oldSlot2.id)) {
                    updates.push({ _id: oldSlot2.id, "system.props.ubicacion_item": "0" });
                }

                updates.push({ _id: item.id, "system.props.ubicacion_item": "1" });
            } else {
                // Drop normal
                updates.push({ _id: item.id, "system.props.ubicacion_item": slotId });
            }

            this._applyUnarmedLogic(updates);

            if (updates.length > 0) {
                await this.actor.updateEmbeddedDocuments("Item", updates);
                ui.notifications.info(`Eldara: ${item.name} equipado.`);
            }

        } catch (err) {
            console.error("Eldara | Error en el Drop:", err);
        }
    }
}

window.EldaraPaperDoll = EldaraPaperDoll;
