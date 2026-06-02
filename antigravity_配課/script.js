document.addEventListener('DOMContentLoaded', () => {
    const tableBody = document.getElementById('table-body');
    const tagsContainer = document.getElementById('tags-container');

    const roleRequirements = {
        '專任': 16,
        '導師': 12,
        '課召': 16
    };

    const courseTypes = [
        { type: 1, title: '高一', tags: [] },
        { type: 2, title: '高二', tags: [] },
        { type: 3, title: '高三', tags: [] },
        { type: 4, title: '資優班', tags: [] },
        { type: 5, title: '探究', tags: [] },
        { type: 6, title: '多元選', tags: [] },
        { type: 7, title: '彈性', tags: [] }
    ];

    let currentTypeIndex = 7;

    const extraColors = ['#f368e0', '#ff9f43', '#ee5253', '#0abde3', '#10ac84', '#222f3e', '#5f27cd', '#ff6b6b', '#48dbfb', '#1dd1a1'];
    function getNextColor() {
        const index = (currentTypeIndex - 7) % extraColors.length;
        return extraColors[index];
    }

    // Initialize tags data
    // Type 1: 高一a ~ 高一h (8 tags), 2 hours
    const type1Letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    type1Letters.forEach(letter => {
        courseTypes[0].tags.push({ id: `type1_${letter}`, name: `高一${letter}`, hours: 2 });
    });

    // Type 2: 高二03 ~ 高二16 (14 tags), 3 hours
    for (let i = 3; i <= 16; i++) {
        const num = i.toString().padStart(2, '0');
        courseTypes[1].tags.push({ id: `type2_${num}`, name: `高二${num}`, hours: 3 });
    }

    // Type 3: 高三03 ~ 高三16 (14 tags), 4 hours
    for (let i = 3; i <= 16; i++) {
        const num = i.toString().padStart(2, '0');
        courseTypes[2].tags.push({ id: `type3_${num}`, name: `高三${num}`, hours: 4 });
    }

    // Type 4: 高一17資 (2), 高二17資 (3), 高三17資 (4), 專題 (2)
    courseTypes[3].tags.push({ id: `type4_1`, name: `高一17資`, hours: 2 });
    courseTypes[3].tags.push({ id: `type4_2`, name: `高二17資`, hours: 3 });
    courseTypes[3].tags.push({ id: `type4_3`, name: `高三17資`, hours: 4 });
    courseTypes[3].tags.push({ id: `type4_4`, name: `專題`, hours: 2 });

    // Type 5: 探究a ~ 探究m (13 tags), 2 hours
    const type5Letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm'];
    type5Letters.forEach(letter => {
        courseTypes[4].tags.push({ id: `type5_${letter}`, name: `探究${letter}`, hours: 2 });
    });

    // Type 6: 多元選a ~ 多元選b (2 tags), 2 hours
    courseTypes[5].tags.push({ id: `type6_a`, name: `多元選a`, hours: 2 });
    courseTypes[5].tags.push({ id: `type6_b`, name: `多元選b`, hours: 2 });

    // Type 7: 彈性1 ~ 彈性3 (3 tags), 0 hours
    courseTypes[6].tags.push({ id: `type7_1`, name: `彈性1`, hours: 0 });
    courseTypes[6].tags.push({ id: `type7_2`, name: `彈性2`, hours: 0 });
    courseTypes[6].tags.push({ id: `type7_3`, name: `彈性3`, hours: 0 });

    function renderCategory(category) {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'category-group';
        categoryDiv.id = `category-${category.type}`;
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'category-header';
        
        const titleEl = document.createElement('h3');
        titleEl.textContent = category.title;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-delete-category';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = '刪除此課程';
        deleteBtn.addEventListener('click', () => {
            if (confirm(`確定要刪除「${category.title}」課程嗎？所有已分配的此課程標籤也會一併移除。`)) {
                const allTags = document.querySelectorAll(`.course-tag[data-type="${category.type}"]`);
                allTags.forEach(tag => tag.remove());
                categoryDiv.remove();
                updateAllRows();
            }
        });
        
        headerDiv.appendChild(titleEl);
        headerDiv.appendChild(deleteBtn);
        categoryDiv.appendChild(headerDiv);

        const tagsWrapper = document.createElement('div');
        tagsWrapper.className = 'category-tags-wrapper';

        category.tags.forEach((tag, index) => {
            const tagEl = document.createElement('div');
            tagEl.className = 'course-tag';
            if (category.type <= 7) {
                tagEl.classList.add(`tag-type-${category.type}`);
            } else {
                tagEl.style.backgroundColor = category.color;
            }
            tagEl.draggable = true;
            tagEl.id = tag.id;
            tagEl.textContent = `${tag.name} (${tag.hours}h)`;
            tagEl.dataset.hours = tag.hours;
            tagEl.dataset.type = category.type;
            tagEl.dataset.originalIndex = index;
            
            tagEl.addEventListener('dragstart', handleDragStart);
            tagEl.addEventListener('dragend', handleDragEnd);
            
            tagsWrapper.appendChild(tagEl);
        });

        categoryDiv.appendChild(tagsWrapper);
        tagsContainer.appendChild(categoryDiv);
    }

    // Initial Render
    courseTypes.forEach(renderCategory);

    // Generate 10 table rows
    for (let i = 0; i < 10; i++) {
        const tr = document.createElement('tr');
        
        // Col 1: Name
        const tdName = document.createElement('td');
        const inputName = document.createElement('input');
        inputName.type = 'text';
        inputName.className = 'name-input';
        inputName.placeholder = '輸入教師姓名...';
        tdName.appendChild(inputName);

        // Col 2: Role
        const tdRole = document.createElement('td');
        const selectRole = document.createElement('select');
        selectRole.className = 'role-select';
        ['專任', '導師', '課召'].forEach(role => {
            const option = document.createElement('option');
            option.value = role;
            option.textContent = role;
            selectRole.appendChild(option);
        });
        selectRole.addEventListener('change', () => updateRowStatus(tr));
        tdRole.appendChild(selectRole);

        // Col 3: Courses (Dropzone)
        const tdCourses = document.createElement('td');
        const dropzone = document.createElement('div');
        dropzone.className = 'course-dropzone';
        dropzone.addEventListener('dragover', handleDragOver);
        dropzone.addEventListener('dragleave', handleDragLeave);
        dropzone.addEventListener('drop', handleDrop);
        tdCourses.appendChild(dropzone);

        // Col 4: Total Hours
        const tdHours = document.createElement('td');
        const spanHours = document.createElement('span');
        spanHours.className = 'hours-display hours-danger';
        spanHours.textContent = '0';
        tdHours.appendChild(spanHours);

        tr.appendChild(tdName);
        tr.appendChild(tdRole);
        tr.appendChild(tdCourses);
        tr.appendChild(tdHours);
        
        tableBody.appendChild(tr);
        
        // Initial update
        updateRowStatus(tr);
    }

    // Set up main tags container as a dropzone too
    tagsContainer.addEventListener('dragover', handleDragOver);
    tagsContainer.addEventListener('dragleave', handleDragLeave);
    tagsContainer.addEventListener('drop', handleDrop);

    // Modal Logic
    const modal = document.getElementById('add-course-modal');
    const btnAddCourse = document.getElementById('add-course-btn');
    const btnCancel = document.getElementById('cancel-add-btn');
    const btnConfirm = document.getElementById('confirm-add-btn');

    btnAddCourse.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    btnCancel.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    btnConfirm.addEventListener('click', () => {
        const nameInput = document.getElementById('new-course-name').value.trim();
        const countInput = parseInt(document.getElementById('new-course-count').value, 10);
        const hoursInput = parseInt(document.getElementById('new-course-hours').value, 10);

        if (!nameInput || isNaN(countInput) || isNaN(hoursInput) || countInput < 1 || hoursInput < 1) {
            alert('請填寫完整且正確的數值！');
            return;
        }

        currentTypeIndex++;
        const newCategory = {
            type: currentTypeIndex,
            title: nameInput,
            color: getNextColor(),
            tags: []
        };

        for (let i = 1; i <= countInput; i++) {
            newCategory.tags.push({
                id: `type${currentTypeIndex}_${i}`,
                name: `${nameInput}${i}`, // E.g., 美術1, 美術2
                hours: hoursInput
            });
        }

        courseTypes.push(newCategory);
        renderCategory(newCategory);
        
        modal.style.display = 'none';
        
        // Reset form
        document.getElementById('new-course-name').value = '';
        document.getElementById('new-course-count').value = '1';
        document.getElementById('new-course-hours').value = '2';
    });


    // Drag and Drop Handlers
    let draggedElement = null;

    function handleDragStart(e) {
        draggedElement = e.target;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => e.target.style.opacity = '0.5', 0);
    }

    function handleDragEnd(e) {
        e.target.style.opacity = '1';
        draggedElement = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const dropzone = e.target.closest('.course-dropzone') || e.target.closest('.tags-container');
        if (dropzone) {
            dropzone.classList.add('drag-over');
        }
        return false;
    }

    function handleDragLeave(e) {
        const dropzone = e.target.closest('.course-dropzone') || e.target.closest('.tags-container');
        if (dropzone) {
            dropzone.classList.remove('drag-over');
        }
    }

    function handleDrop(e) {
        e.stopPropagation();
        e.preventDefault();
        
        const dropzone = e.target.closest('.course-dropzone') || e.target.closest('.tags-container');
        if (dropzone) {
            dropzone.classList.remove('drag-over');
            if (draggedElement && draggedElement !== dropzone) {
                if (dropzone.classList.contains('tags-container')) {
                    // Find the correct category wrapper
                    const type = draggedElement.dataset.type;
                    const categoryWrapper = document.querySelector(`#category-${type} .category-tags-wrapper`);
                    if (categoryWrapper) {
                        categoryWrapper.appendChild(draggedElement);
                        
                        // Sort the elements in this specific category wrapper
                        const sortedTags = Array.from(categoryWrapper.children).sort((a, b) => {
                            return parseInt(a.dataset.originalIndex) - parseInt(b.dataset.originalIndex);
                        });
                        sortedTags.forEach(tag => categoryWrapper.appendChild(tag));
                    }
                } else {
                    // Dropped into a row's dropzone
                    dropzone.appendChild(draggedElement);
                }
                
                // Update rows
                updateAllRows();
            }
        }
        return false;
    }

    function updateRowStatus(row) {
        const role = row.querySelector('.role-select').value;
        const requiredHours = roleRequirements[role];
        
        const tags = row.querySelectorAll('.course-tag');
        let totalHours = 0;
        tags.forEach(tag => {
            totalHours += parseInt(tag.dataset.hours, 10);
        });

        const hoursDisplay = row.querySelector('.hours-display');
        hoursDisplay.textContent = totalHours;

        if (totalHours < requiredHours) {
            hoursDisplay.className = 'hours-display hours-danger';
        } else {
            hoursDisplay.className = 'hours-display hours-success';
        }
    }

    function updateAllRows() {
        const rows = tableBody.querySelectorAll('tr');
        rows.forEach(row => updateRowStatus(row));
    }
});
